const config = require("./configbot.json");
const dateFormat = require('dateformat');
const SteamTotp = require('steam-totp');
const SteamUser = require('steam-user');
const steam = require('steam-login');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
var mysql = require('mysql');
const client = new SteamUser();
const community = new SteamCommunity();
const fs = require('fs');
const path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const price = require('./price.json');
const pricepubg = require('./pubgprice.json');
console.log(SteamTotp.generateAuthCode(config.steam.shared_secret));

process.on('uncaughtException', function (err) {
  console.log(err);
})

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: 'withdraw'
});

con.connect(function(err) {
    if (err) throw err;
    console.log("[MYSQL] Connected!");
});




app.use(require('express-session')({
    resave: false,
    saveUninitialized: false,
    secret: '7df362859d82d6bc3935bb708cf81e44'
}));
app.use(steam.middleware({
    realm: 'http://localhost:3000/',
    verify: 'http://localhost:3000/verify',
    apiKey: config.apiKey
}));
app.use(express.json());
app.use(express.urlencoded());
app.get('/settlink', function(req, res) {
    if (req.user == null) {
        res.redirect('/');
    } else {
    con.query("UPDATE users SET `tradetoken`='" + req.query.tlink.split("=")[2] + "' WHERE steamid64='" + req.user.steamid + "'");
    res.send('tradelink set <a href="/">go back</a>')
    }
    });
    app.post('/cardstatus', function(req, res) {
    console.log(req.body);
    if(!isNaN(req.body)){
    	con.query("SELECT * FROM cards WHERE id='" + req.body + "'", function(err, card) {
            if (!err) {
            	if(card[0].status == 'free'){
            		res.send('1');
            	}else{
            		res.send('2');
            	}
            }else{
            	res.send('3')
            }
        });
    }else{
    res.send('3')
    }
    });
    app.post('/buycard', function(req, res) {
    console.log(Object.keys(req.body)[0]);
    if(!isNaN(Object.keys(req.body)[0])){
    	con.query("SELECT * FROM cards WHERE id='" + Object.keys(req.body)[0] + "'", function(err, card) {
            if (!err) {
            	console.log(card[0])
            	if(card[0].status == 'free'){
            		con.query("SELECT * FROM users WHERE steamid64='" + req.user.steamid + "'", function(err, user) {
            			if(user[0].balance > card[0].price){
            				con.query("UPDATE cards SET `status`='sold' WHERE id='" + Object.keys(req.body)[0] + "'", function(err) {
            					if(!err){
								res.send("Your code is " + card[0].code);
            						 con.query("UPDATE `users` SET `balance`=`balance`-" + card[0].price + " WHERE `steamid64`='" + req.user.steamid + "'");

            					}else{
            						res.send("Your code is already sold, Your funds have not be changed. Please refresh and try again")
            					}
            				});
            			}else{
            				res.send("It seems like you have not enough funds.");
            			}

            		});
            	}else{
            		res.send("Your code is already sold, Your funds have not be changed. Please refresh and try again");
            	}
            }else{
            	res.send("Error! Please try again");
            }
        });
    }else{
    res.send('3')
    }
});

app.post('/send', function(req, res) {
    if (req.user == null) {
        res.redirect('/');
    } else {
    	//TODO:check if withdraw contains more then 8 items
        con.query("SELECT * FROM users WHERE steamid64='" + req.user.steamid + "'", function(err, user) {
            if (!err) {
                console.log(user);
               con.query("SELECT * FROM `trades` WHERE `steamid64`='" + req.user.steamid + "' AND `status`='sent'", function(err, usertrades) {
            	if(!err){
				if(usertrades.length < 3){
                var offer = manager.createOffer(req.user.steamid);
                con.query("SELECT * FROM items WHERE assetid='" + Object.keys(req.body)[0] + "'", function(err, appid) {
                      con.query("INSERT INTO `trades` (`id`, `steamid64`, `items`, `gameid`, `status`, `time`, `value`) VALUES (NULL, '" + req.user.steamid + "', '" + JSON.stringify(req.body) + "', '" + appid[0].gameid + "', 'init', '" + Math.floor(Date.now() / 1000) + "', '0');", function(err, trades){
                console.log(trades);
                if(err){
                console.log(err)
                res.send("we can't connect to database. Please try again in a minute")
                }else{
               manager.getUserInventoryContents(client.steamID.getSteamID64(), appid[0].gameid, 2, true, function(err, inventory, currencies) {
                    offer.getUserDetails(function(err, me, them) {
                        if (err) {
                            console.log('Failed to get user details for ' + them + '\n' + err);
                            return;
                        }
                        if (them.escrowDays != 0) {
                            // user is affected by steam escrow
                            console.log('Couldn\'t send trade offer! User is affected by escrow!');
                            return;
                        } else {
                            //console.log(inventory);
                            var value = 0;
                            var offeritems = [];
                            var gameid = '';
                            for (key in req.body) {
                                for (item in inventory) {
                                    if (inventory[item].assetid == key) {
                                        con.query("SELECT * FROM items WHERE assetid='" + key + "'", function(err, result) {
                                            if (!err) {
                                            if(result[0].status === 'free'){
                                            	if(gameid === ''){
                                            		gameid = result[0].gameid;
                                            	}
                                            	if(gameid !== '' && gameid !== result[0].gameid){
                                            		res.send('you can only send offer with items of the same game');
                                            	}
                                            	console.log(gameid + ' ' + result[0].gameid)
                                                if (req.body[key] == '1') {
                                                    value += result[0].price * 1;
                                                }
                                                offeritems.push(inventory[item]);
                                                if (offeritems.length == Object.keys(req.body).length) {
                                                    //TODO:check balance & send trade
                                                    for (keys in req.body) {
                                                        if (req.body[keys] == '1') {
                                                            offer.addMyItem({
                                                                assetid: keys,
                                                                contextid: 2,
                                                                appid: result[0].gameid
                                                            });
                                                        }
                                                    }
                                                    con.query("SELECT * FROM users WHERE steamid64='" + req.user.steamid + "'", function(err, user) {
                                                        console.log(user[0].balance * 1 + ' ' + value * 1)
                                                        if (user[0].balance * 1 >= value * 1) {
                                                            con.query("UPDATE `users` SET `balance`=`balance`-" + value + " WHERE `steamid64`='" + req.user.steamid + "'", function(err) {
                                                                if (err) {
                                                                    res.send('Error happend');
                                                                } else {
                                                                offer.setMessage("If your offer seems wrong don't accept. OfferID:" + trades.insertId);
                                                                    setTimeout(function() {
                                                                        offer.send(function(err, status) {
                                                                            if (err) con.query("UPDATE `users` SET `balance`=`balance`+" + value + " WHERE `steamid64`='" + req.user.steamid + "'");
																			if (!err) con.query("UPDATE `trades` SET `value`='" + value + "',`status`='sent',`time`='" + Math.floor(Date.now() / 1000) + "' WHERE `id`='" + trades.insertId + "'");
																			if (err) con.query("UPDATE `trades` SET `status`='unable to send',`time`='" + Math.floor(Date.now() / 1000) + "' WHERE `id`='" + trades.insertId + "'");
																			if(!err){
																			for (keys in req.body) {
																				    con.query("UPDATE `items` SET `status`='intrade' WHERE `assetid`='" + keys + "'")
																			}
																			}
                                                                            console.log(status);
                                                                            res.send("https://steamcommunity.com/tradeoffer/"+offer.id);
                                                                            console.log("offerid: " + offer.id);

                                                                        });

                                                                        console.log('all items added');
                                                                    }, 1000);
                                                                }
                                                            });
                                                        } else {
                                                            res.send('You have not enough balance');
                                                        }
                                                    });
                                                }
                                                }else{
                                                res.send('One of the items you selected is already intrade.Please refresh');
                                                }
                                            }
                                        });
                                    }

                                }
                            }
                            console.log(value);

                            console.log(req.body);
                        }
                    });
                });
                }
                });
                });
                }else{
                res.send('You already have 2 open trades. Please accept or decline them. Then send request again');
                }
                }
                });

                }
                });

            }
        });
;




app.set('view engine', 'ejs');

app.get('/entry.png', function(req, res) {
    res.sendFile(path.join(__dirname + '/views/entry.png'));

});
app.get('/', function(req, res) {
    if (req.user == null) {
        res.render('entry');
    } else {
        con.query("SELECT * FROM users WHERE steamid64='" + req.user.steamid + "'", function(err, user) {
            if (user.length == 0) {
                con.query("INSERT INTO `users` (`id`, `steamid64`, `balance`, `tradetoken`) VALUES (NULL, '" + req.user.steamid + "', '0', '')");
                res.render('index', {
                    steamid: req.user.steamid,
                    balance: 0
                });
            } else {
                res.render('index', {
                    steamid: req.user.steamid,
                    balance: user[0].balance
                });
            }
        });
    }
});

app.get('/authenticate', steam.authenticate(), function(req, res) {
    res.redirect('/');
});

app.get('/verify', steam.verify(), function(req, res) {
    //res.send(req.user).end();
    res.redirect('/');
});

app.get('/logout', steam.enforceLogin('/'), function(req, res) {
    req.logout();
    res.redirect('/');
});
app.get('/sendtrade', function(req, res) {
    if (req.user == null) {
        console.log('login')
    } else {
        //SENDTRADE
    }
});

function sendData() {
    //io.sockets.emit('binv', db.get('stock').value().amount.toString());
}


function sendMessage(steamid64, msg) {
    if (io.sockets.connected[connected[steamid64]]) {
        io.sockets.connected[connected[steamid64]].emit('msg', msg);
    }
}

function sendMsg(steamid64, msg) {
    if (io.sockets.connected[connected[steamid64]]) {
        io.sockets.connected[connected[steamid64]].emit('msg', msg);
    }
}
var connected = [];
setInterval(function() {
    sendData();
}, 1000);
io.on('connection', function(socket) {
    socket.emit('tlink', config.tlink)

    //CSGO
    con.query("SELECT * FROM items WHERE status='free' AND gameid='730'", function(err, result) {
        if (!err) {
            socket.emit('CSGOinv', result);
        }
    });
	//PUBG
	 con.query("SELECT * FROM items WHERE status='free' AND gameid='578080'", function(err, result) {
        if (!err) {
            socket.emit('PUBGinv', result);
        }
    });
	//CARDS
    con.query("SELECT * FROM cards WHERE status='free'", function(err, result) {
        if (!err) {
            socket.emit('cards', result);
        }
    });


    console.log('connected' + socket.id);
    socket.on('steamid', function(data) {});
    console.log('a user connected');
    socket.on('disconnect', function() {
        console.log('disconnected' + socket.id);
    })
});

http.listen(config.port, function() {
    console.log('listening on *:' + config.port);
});

const logOnOptions = {
    "accountName": config.steam.username,
    "password": config.steam.password,
    "twoFactorCode": SteamTotp.generateAuthCode(config.steam.shared_secret)
};
const manager = new TradeOfferManager({
    "steam": client,
    "domain": config.steam.domain,
    "language": "en",
    "cancelTime": 150000,
    "pollInterval":15000
});

client.logOn(logOnOptions);
client.on('loggedOn', function(details) {
    console.log("Logged into Steam as " + client.steamID.getSteam3RenderedID());
    client.setPersona(SteamUser.EPersonaState.Online);
});

client.on('error', function(e) {
    console.log(e);
});

client.on('webSession', function(sessionID, cookies) {
    manager.setCookies(cookies, function(err) {
        if (err) {
            console.log(err);
            process.exit(1);
            return;
        }
    });

    community.setCookies(cookies);
    community.chatLogon();
    community.startConfirmationChecker(15000, config.steam.secret);
});
community.on('sessionExpired', function(err) {
    console.log('Session expired.');
    if (err) {
        if (err.message == "Not Logged In") {
            console.log("Trying the error login.");
            client.webLogOn();
            community.chatLogon();
        } else {
            console.log(err.message);
        }
    } else {
        console.log('Trying to re-login.');
        client.webLogOn();
    }
});

function check_trades(){
	manager.getOffers(3, function(err, sent){
		if(!err){
		var keys = Object.keys(sent);
			keys.forEach(function(i){
			var offer = sent[i];
				//console.log(sent[i]);
				if(offer.message.indexOf('OfferID:') > -1){

					//console.log('|' + sent[i].message.split("OfferID:")[1] + '|');
					//console.log(offer.message.split("OfferID:")[1]);
					con.query("SELECT * FROM `trades` WHERE `id`='" + offer.message.split("OfferID:")[1] + "'", function(err, tradeinfo){
					if(tradeinfo.length > 0){
					if(tradeinfo[0].status === 'sent'){
					//console.log(offer);
					if(offer.state != 9){
					if(offer.state != 2 ){
						if(offer.state == 3){
							//console.log('accepted');
							con.query("UPDATE `trades` SET `status`='done' WHERE `id`='" + tradeinfo[0].id + "'");
							for(j in offer.itemsToGive){
									con.query("UPDATE `items` SET `status`='sold' WHERE `assetid`='" + offer.itemsToGive[j].assetid + "'");
								}
							//TODO:set items.status in offer to sold
						}else{
								con.query("UPDATE `trades` SET `status`='refunded' WHERE `id`='" + tradeinfo[0].id + "';", function(err, res){ console.log(err);console.log(res) });
								con.query("UPDATE `users` SET `balance`=`balance`+" + tradeinfo[0].value + " WHERE `steamid64`='" + tradeinfo[0].steamid64 + "'", function(err, res){ console.log(err);console.log(res) });
								for(j in offer.itemsToGive){
									con.query("UPDATE `items` SET `status`='free' WHERE `assetid`='" + offer.itemsToGive[j].assetid + "'");
								}
								//TODO:set items.statu7s in offer to free
						}
					}else{
						//console.log('offer active')
					}
					}
					}
					}
					});
				}

			});
			//console.log(sent);
		}
	});
}
setInterval(function(){
check_trades()
}, 20000);


setInterval(function() {
    update_bot_invcsgo();
    update_bot_invpubg();
}, 60000)

function update_bot_invcsgo() {
    manager.getUserInventoryContents(client.steamID.getSteamID64(), 730, 2, true, function(err, inventory, currencies) {
        if (err) {
            console.log(err.message);
        } else {

            var inv = {};
            inv = [];
            //console.log(inventory[0]);
            var itemexisting = [];
            con.query("SELECT * FROM `items` WHERE `gameid`='730'", function(err, itemcheck) {
            for (let i = 0; i < inventory.length; i++) {
            	for(inum in itemcheck){
            		if(itemcheck[inum].assetid == inventory[i].assetid){
            			itemexisting.push(inventory[i].assetid);
            		}
            	}
                con.query("SELECT * FROM `items` WHERE `assetid`='" + inventory[i].assetid + "'", function(err, result) {
                    if (result.length === 0) {
                        con.query("INSERT INTO `items` (`id`, `name`, `price`, `assetid`, `gameid`, `status`, `url`) VALUES (NULL, '" + inventory[i].market_name + "', '" + price[inventory[i].market_name] + "', '" + inventory[i].assetid + "', '730', 'free', 'https://steamcommunity-a.akamaihd.net/economy/image/" + inventory[i].icon_url + "');", function(err, result) {
                            if (err) throw err;
                        });
                    } else {
                        if (result.price !== price[inventory[i].market_name]) {
                            con.query("UPDATE `items` SET `price`='1' WHERE `assetid`='" + price[inventory[i].market_name] + "'")
                        }

                    }
                });
                if(i === (inventory.length-1)){
                    for(inum in itemcheck){
                		itemcheck[inum].assetid;
                		if(itemexisting.indexOf(itemcheck[inum].assetid) > -1){
                		}else{
                			console.log(itemcheck[inum].assetid);
                			con.query("UPDATE `items` SET `status`='away' WHERE `assetid`='" + itemcheck[inum].assetid + "'");
                		}
                	}

                }
            }
            });
        }
    });
}
function update_bot_invpubg() {
    manager.getUserInventoryContents(client.steamID.getSteamID64(), 578080, 2, true, function(err, inventory, currencies) {
        if (err) {
            console.log(err.message);
        } else {

            var inv = {};
            inv = [];
            //console.log(inventory[0]);
            var itemexisting = [];
            con.query("SELECT * FROM `items` WHERE `gameid`='578080'", function(err, itemcheck) {
            for (let i = 0; i < inventory.length; i++) {
            	for(inum in itemcheck){
            		if(itemcheck[inum].assetid == inventory[i].assetid){
            			itemexisting.push(inventory[i].assetid);
            		}
            	}
                con.query("SELECT * FROM `items` WHERE `assetid`='" + inventory[i].assetid + "'", function(err, result) {
                    if (result.length === 0) {
                        con.query("INSERT INTO `items` (`id`, `name`, `price`, `assetid`, `gameid`, `status`, `url`) VALUES (NULL, '" + inventory[i].market_name + "', '" + pricepubg[inventory[i].market_name] + "', '" + inventory[i].assetid + "', '578080', 'free', 'https://steamcommunity-a.akamaihd.net/economy/image/" + inventory[i].icon_url + "');", function(err, result) {
                            if (err) throw err;
                        });
                    } else {
                        if (result.price !== pricepubg[inventory[i].market_name]) {
                            con.query("UPDATE `items` SET `price`='" + pricepubg[inventory[i].market_name] + "' WHERE `assetid`='" + inventory[i].assetid + "'")
                        }

                    }
                });
                if(i === (inventory.length-1)){
                    for(inum in itemcheck){
                		itemcheck[inum].assetid;
                		if(itemexisting.indexOf(itemcheck[inum].assetid) > -1){
                		}else{
                			console.log(itemcheck[inum].assetid);
                			con.query("UPDATE `items` SET `status`='away' WHERE `assetid`='" + itemcheck[inum].assetid + "'");
                		}
                	}

                }
            }
            });
        }
    });
}
