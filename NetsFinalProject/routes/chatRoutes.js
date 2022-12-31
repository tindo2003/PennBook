const { Route53Resolver } = require('aws-sdk');
var db = require('../models/database.js');
var fdb = require('../models/friendDatabase.js');

//Called when attempting to join a chat room
var joinRoom = function(req, res) {
    if (req.session.username) {
        console.log("All online users: ", req.online);
        //first fetch the userID
		db.getUserInfo(req.session.username, function(err, data) {
            if (!data) {
                console.log("error retrieving user ID");
            } else {
                var userID = data.Item.userID.S;
                var firstName = data.Item.firstName.S;
                var lastName = data.Item.lastName.S;
                var messageStructList = [];
                //Check if the current user is a member of the chat they are attempting to join
                db.userInChat(req.query.chatID, userID, function(member) {
                    if (member) {
                        //If they are in the chat, retrieve logged messages and redirect to the chat room
                        db.getMessages(req.query.chatID, function(err, messages) {
                            if (err) {
                                console.log("error retrieving messages");
                            } else {
                                console.log("All messages", messages);

                                //Create promises to find the usernames, first names, and last names for a given userID
                                Promise.all(messages.map(function(message) {
                                    return new Promise(function(resolve, reject) {
                                        var user = message.userID.S;
                                        db.getUserInfoFromID(user, function(error, datas) {
                                            if (!datas) {
                                                console.log(error);
                                                reject(error);
                                            } else {
                                                messageStructList.push({firstName: datas.Item.firstName.S, 
                                                    lastName: datas.Item.lastName.S, 
                                                    username: datas.Item.username.S, 
                                                    message: message.message.S,
                                                    timestamp: message.timestamp.N,});
                                                resolve(true);
                                            }
                                        })
                                    });
                                })).then(function() {
                                    //Sort messages by time posted
                                    messageStructList.sort(function(a, b) {
                                        return a.timestamp - b.timestamp;
                                    })
                                    console.log("Struct", messageStructList);
                                  
                                    //Render with relevent data
                                    res.render("chatRoom.ejs", {user: userID, roomID: req.query.chatID, 
                                                                    messages: messageStructList, 
                                                                    username: req.session.username,
                                                                    firstName: firstName, 
                                                                    lastName: lastName});
                                });
                            }
                        })
                    } else {
                        //If they are not, simply redirect to the home page
                        res.redirect("/homepage");
                    }
                })
            }
        });
	} else {
        //if not logged it, redirect to log in page
		res.redirect('/')
	}
}

//Log each message that is sent into dynamo
var logMessage = function(req, res) {
    db.logMessage(req.body.chatID, req.body.userID, req.body.message, req.body.timestamp, function(err, data) {
        if (err) {
            console.log("error logging message", err);
            return res.send({success: false});
        } else {
            console.log("Succesfully logged message on server side");
            return res.send({success: true});
        }
    })
}

//get all chat rooms a user is in
var getChatRooms = function(req, res) {
    if (req.session.username) {
        //get user ID from username
		db.getUserID(req.session.username, function(err, data) {
            if (err) {
                console.log("error retrieving user ID");
            } else {
                //get the chats they are in from db
                db.getUserChatsWithMembers(data, function(err, chatsMap) {
                    if (err) {
                        console.log("no chats to display");
                        res.render('chats.ejs', {chatsMap: null, username: req.session.username});
                    } else {
                        console.log("Map keyed by chatID valued by members: ", chatsMap);
                        //Make the map into an array such that the each map key pair is now a tuple in an array with the first element
                        //being the key(chatID) and the second element being the value being the list of users in that chat.
                        var chatsArray = Array.from(chatsMap, ([chatID, users]) => ({chatID, users}));
                        const newMap = new Map();
                        console.log("The chats array", chatsArray);
                        //res.render('chats.ejs', {chatsMap: chatsArray, username: req.session.username});

                        const promiseList = [];
                        
                        //Create promise to find the first name, last name, and username of each user in the above array
                        chatsArray.forEach(chatTuple => {
                            var chat = chatTuple.chatID;
                            chatTuple.users.forEach(user => {
                                const promise = new Promise((resolve, reject) => {
                                    if (user != "you") {
                                        db.getUserInfoFromID(user, function(err, data) {
                                            if (!data) {
                                                reject(err);
                                            } else {
                                                //If map doesn't have entry already instantiate it to have empty array
                                                if (!newMap.has(chat)) {
                                                    newMap.set(chat, [])
                                                }
                                                //Append to array relevent information
                                                var userEntry = data.Item.firstName.S + " " + data.Item.lastName.S + " (@" + data.Item.username.S + ")";
                                                newMap.get(chat).push(userEntry);
                                                console.log("Chat entry for user", userEntry);
                                                resolve(true);
                                            }
                                        });
                                    } else {
                                        //If userID and current user are same, set the name to "you"
                                        if (!newMap.has(chat)) {
                                            newMap.set(chat, []);
                                        }
                                        var userEntry = "you";
                                        newMap.get(chat).push(userEntry);
                                        resolve(true);
                                    }
                                });
                                promiseList.push(promise);
                            })
                        })

                        //Execute promises and then render the page with the information
                        Promise.all(promiseList).then(function() {
                            console.log("new map", newMap);
                            var newChatsArray = Array.from(newMap, ([chatID, users]) => ({chatID, users}));
                            console.log("new chats array", newChatsArray);
                            res.render('chats.ejs', {chatsMap: newChatsArray, username: req.session.username});
                        });
                    }
                });
            }
        });
	} else {
		res.redirect('/')
	}
}

//Given a list of online users, filter it to only contain friends
var getOnlineFriends = function(req, res) {
    if (req.body.onlineusers) { //Only execute if list is not null
        db.getUserID(req.session.username, function(err, userID) { //Get user ID
            if (!userID) {
                return res.send({success: false});
            } else {
                fdb.getFriends(userID, function(error, friends) { //Get user friends
                    if (error) {
                        return res.send({success: false});
                    } else {
                        console.log("List of friends: ", friends);
                        var allusers = new Set(req.body.onlineusers); //Create set of all online users
                        const onlineFriends = new Set();
                        console.log("allusers", allusers);

                        //Itereate through all friends and check if they are in the online users set
                        Promise.all(friends.Items.map(function(friend) {
                            return new Promise(function(resolve, reject) {
                                db.getUserInfoFromID(friend.followedID.S, function(err, data) {
                                    if (!data) {
                                        console.log("error retrieving friend information");
                                        reject(err);
                                    } else {
                                        var friendUserName = data.Item.username.S;
                                        if (allusers.has(friendUserName)) {
                                            //If is in set, add to filtered list
                                            console.log("shared", friendUserName);
                                            onlineFriends.add(friendUserName);
                                        }
                                        resolve(true);
                                    }
                                })
                            })
                            //onlineFriends.add(friend.followedID.S);
                        })).then(function() {
                            //Render page with friends
                            console.log("Friends please work", onlineFriends);
                            return res.send({success: true, list: Array.from(onlineFriends)});
                        })
                    }
                })
            }
        })
    } else {
        return res.send({success: true, list: null});
    }
}

//Given recipient username, sender username, and chatID send the recipient user a chat invite
var addUserToChatRoom = function(req, res) {
    //Get user id of recipient user
    db.getUserID(req.body.recipientUser, function(e, userID) {
        db.userInChat(req.body.chatID, userID, function(member) { //only execute if user isn't already in chat
            console.log("Is user already member: ", member);
            if (!member) {
                //Call db method to send the invite
                db.addUserToChatRoom(req.body.sendUser, req.body.recipientUser, req.body.chatID, function(err, data) {
                    if (err) {
                        return res.send({success: false});
                    } else {
                        return res.send({success: true});
                    }
                });
            } else {
                return res.send({success: true, message: "User already in chat!"});
            }
        })
    })
}

//Accept chat invitation
var acceptChatInvite = function(req, res) {
    var recipientID = req.body.recipientID
    var senderID = req.body.senderID
    var senderUsername = req.body.senderUserName
    var timestamp = req.body.timestamp
    var chatID = req.body.chatID
    

   //Call appropriate db method to accept invite
   db.acceptChatInvite(recipientID, senderID, senderUsername, timestamp, chatID, function(err,data) {
       if (err) {
            var content = {
                success: false, 
                message: "failure in our system to accept chat invite. Please try again later"
            } 
            res.send(JSON.stringify(content))
       } else {
           console.log("back from db")
            var content = {
                success: true, 
                message: "successfully chat invite with " + senderUsername
            }
            res.send(JSON.stringify(content))
       }
   })
}

//Create chat room with user invitation
var createChatRoom = function(req, res) {
    var sendername = req.body.sender;
    var recipientname = req.body.recipient;
    console.log("Trying to create new chat room for :", sendername);
    console.log("Trying to add: ", recipientname);
    //Only execute if the two users aren't already in a DM (i.e. there doesn't exist a chat with only these 2 users)
    db.checkInDM(sendername, recipientname, function(noDMs, chatDM) {
        if (noDMs) {
            //get IDs of both users
            db.getUserID(sendername, function(e, d) {
                var sender = d;
                console.log("Sender, ", sender);
                db.getUserID(recipientname, function(er, da) {
                    var recipient = da;
                    console.log("Recip", recipient);
                    //Create the new chat room
                    db.createChatRoom(sender, function(err, data) {
                        if (err) {
                            console.log("created new chat room");
                            return res.send({success: false});
                        } else {
                            //Once created, send invite to chat room
                            console.log("Adding user to new chat: ", data);
                            db.addUserToChatRoom(sendername, recipientname, data, function(error, dat) {
                                if (error) {
                                    console.log("error adding user to new chat");
                                } else {
                                    console.log("added user to new chat");
                                    return res.send({success: true, chatID: data});
                                }
                                
                            })
                        }
                    })
                })
            })
        } else {
            return res.send({success: true, chatID: chatDM});
        }
    })
}

//Reject invitation to join a chat room
var rejectChatInvite = function(req, res) {
    var recipientID = req.body.recipientID
    var senderID = req.body.senderID
    var senderUsername = req.body.senderUserName
    var timestamp = req.body.timestamp
    var chatID = req.body.chatID

    db.rejectChatInvite(recipientID, senderID, senderUsername, timestamp, chatID, function(err, data) {
        if (err) {
            var content = {
                success: false, 
                message: "failure in our system to accept chat invite. Please try again later"
            } 
            res.send(JSON.stringify(content))
       } else {
           console.log("back from db")
            var content = {
                success: true, 
                message: "successfully chat invite with " + senderUsername
            }
            res.send(JSON.stringify(content))
       }
    })
}

var chatRoutes = {
    joinRoom: joinRoom,
    logMessage: logMessage,
    getChatRooms: getChatRooms,
    getOnlineFriends: getOnlineFriends,
    addUserToChatRoom: addUserToChatRoom,
    acceptChatInvite: acceptChatInvite,
    createChatRoom: createChatRoom,
    rejectChatInvite: rejectChatInvite
}

module.exports = chatRoutes;