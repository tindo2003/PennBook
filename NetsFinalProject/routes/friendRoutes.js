const { response } = require('express');
const { getUserID } = require('../models/database.js');
var db = require('../models/friendDatabase.js');
 

/* This will called whenever a friend request button is pressed on the client
side */
var addFriend = function(req, res) {
    var friendWantToAdd = req.session.visitinguser 
    var friendAdder = req.session.username 

    db.addFriend(friendWantToAdd, friendAdder, function(err, data) {
        // TODO
        if (err) {
            var content = {
                "success": false, 
                "message": "An error has happened with the databse"
            }
            res.send(JSON.stringify(content))
        } else if (data) {
            var content
            if (data == "a") {
                content = {
                    "success": false, 
                    "message": "You guys are already friends"
                }
            } else if (data == "b") {
                content = {
                    "success": false, 
                    "message": "Notification already exists"
                }
            }
            
            res.send(JSON.stringify(content))
        } else {
            console.log("lolllll")
            var content = {
                "success": true, 
                "message": "A friend request has been sent for approval"
            }
            res.send(JSON.stringify(content))
        }
       
    })
}

/* A user will be able to accept frriend request */
var acceptFriendRequest = function(req, res) {
    var recipientID = req.body.recipientID
    var senderID = req.body.senderID
    var senderUsername = req.body.senderUserName
    var timestamp = req.body.timestamp
    console.log(recipientID)
    console.log(senderID)
    console.log(senderUsername)
    console.log(timestamp)
    db.acceptFriendRequest(recipientID, senderID, timestamp, function(err, data) {
        if (err) {
            var content = {
                success: false, 
                message: "failure in our system to add friend. Please try again later"
            } 
            res.send(JSON.stringify(content))
        } else {
            var content = {
                success: true, 
                message: "successfully friend with " + senderUsername
            }
            res.send(JSON.stringify(content))
        }
    })
}

var friendRoutes = {
    addFriend: addFriend, 
    acceptFriendRequest: acceptFriendRequest,
}

module.exports = friendRoutes;