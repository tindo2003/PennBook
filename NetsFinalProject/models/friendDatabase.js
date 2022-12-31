const { IotData } = require('aws-sdk');
var AWS = require('aws-sdk');
const e = require('express');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
var rootDB = require('../models/database.js');

/* This function checks if the notification already exists. If
it does not exist, it will add it to the notification table*/
var addFriend = function(friendWantToAdd, friendAdder, callback) {
    rootDB.getUserID(friendWantToAdd, function(err, friendWantToAddUserID) {
        if (err) {
            console.log("hello world", err)
        } else if (!friendWantToAddUserID) {

        } else {
            rootDB.getUserID(friendAdder, function(err, friendAdderUserID) {
                if (err) {
                    console.log("hello world", err)
                } else if (!friendAdderUserID) {

                } else {
                    var adderID = friendWantToAddUserID
                    var addedID = friendAdderUserID
                    console.log(adderID)
                    console.log(addedID)
                    // TODO: PROBALY ALSO NEED TO CHECK IF THE REQUEST IS ALREADY SENT
                    getFriend(adderID, addedID, function(err, data) {
                        if (err) {
                            console.log(err)
                            callback(err, null)
                        } else if (data) {
                            // there exists friend relationship
                            callback(err, "a") // get data? 
                        } else {
                            // there does not exist friend relationship
                            
                            var paramsToQueryIfNotificationAlreadyExisted = {
                                TableName: "Notification", 
                                KeyConditionExpression: "recipientID =:r",
                                FilterExpression: "notificationType = :n and senderID = :s",
                                ExpressionAttributeValues : {
                                    ":r": {
                                        "S": friendWantToAddUserID
                                    },
                                    ":s": {
                                        "S": friendAdderUserID
                                    }, 
                                    ":n": {
                                        "S": "friendRequest"
                                    }
                                }
                                
                            }
                            console.log(paramsToQueryIfNotificationAlreadyExisted)
                            db.query(paramsToQueryIfNotificationAlreadyExisted, function(err, data) {
                                if (err) {
                                    console.log("lmaooooo")
                                    console.log(err)
                                    callback(err, null)
                                } else if (data.Items.length != 0) {
                                    // notification already in 
                                    console.log("MY DATA IS !!!!!!!", data)
                                    callback(err, "b")
                                } else {
                                    // TODO 1: Send friend request notification to other user
                                    console.log("trying to add friends")
                                    var params = {
                                        TableName: "Notification", 
                                        Item : {
                                            "recipientID": {
                                                "S": friendWantToAddUserID
                                            }, 
                                            "senderID": {
                                                "S": friendAdderUserID
                                            }, 
                                            "timestamp": {
                                                "S": Math.floor(Date.now() / 1000) + ""
                                            }, 
                                            "notificationType": {
                                                "S": "friendRequest"
                                            }
                                        }
                                    }
                                    db.putItem(params, function(err, data) {
                                        if (err) {
                                            console.log(err)
                                            callback(err, null)
                                        } else {
                                            callback(err, null)
                                        }
                                    })
                                }
                            }) 
                            
                        }
                    })
                }
            })
        }
    })
}

/* If X accepts a friend request from Y, it will add a pair (X, Y) and (Y, X)
to the Friends database. It also deletes the corresponding item in the 
notification table. 
*/

var acceptFriendRequest = function(recipientID, senderID, timestamp, callback) {
    console.log("i am in friendDatabase, accepting friend request")
    var params = {
        TableName: "Friends", 
        Item: {
            followerID: {
                "S" : senderID
            },
            followedID: {
                "S": recipientID
            }, 
            timestamp: {
                "S": Date.now() + ""
            }
        }
    }
    db.putItem(params, function(err, data) {
        if (err) {
            console.log(err)
            callback(err, null)
        } else {
            
            // add the other way around
            var anotherParams = {
                TableName: "Friends", 
                Item: {
                    followerID: {
                        "S" : recipientID
                    },
                    followedID: {
                        "S": senderID
                    }, 
                    timestamp: {
                        "S": Date.now() + ""
                    }
                }
            }
            db.putItem(anotherParams, function(err, data) {
                if (err) {
                    callback(err, null);
                } else {
                    // DELETE NOTIFICATION FROM THE NOTIFICATION TABLE
                    console.log("Was I ever here?")
                    var paramsToDelete = {
                        TableName: "Notification",
                        Key: {
                            "recipientID": {
                                "S": recipientID
                            }, 
                            "timestamp": {
                                "S": timestamp
                            }
                        }, 
                        ConditionExpression: "senderID = :s", 
                        ExpressionAttributeValues: {
                            ":s" : {
                                "S": senderID
                            }
                            
                        }
                    }
                    console.log(paramsToDelete)
                    db.deleteItem(paramsToDelete, function(err, data) {
                        if (err) {
                            console.log(err)
                            callback(err, null);
                        } else {
                            callback(err, data)
                        }
                        
                    })
                    
                    
                }
            
            })
        }
    })
}


/* This is to check if there is a friend connection between a friend
and another friend. It takes in two userIDs.
*/
var getFriend = function(followerID, followedID, callback) {
    console.log("i was here")
    var params = {
        TableName: "Friends", 
        Key: {
            'followerID': {
                "S": followerID
            }, 
            'followedID': {
                "S": followedID
            }
        }, 
    }
    db.getItem(params, function(err, data) {
        if (err) {
            console.log("There is an error", err)
            callback(err, null)
        } else if (data.Item) {
            console.log("Friend already exist", data)
            console.log(data)
            callback(err, data);
        } else {
            console.log("friend does not exist")
            callback(err, null);
        }
    })
}

/* this function queries the Account table for the userID then
queries the table for notifications associated with the 
userID. It then sends back information corresponding to the notification 
type
*/
var getNotifications = function(username, callback) {
    
    var username = username
    rootDB.getUserID(username, function(err, userID) {
        if (err) {
            console.log("error at getNotifications in friendDatabase")
            console.log(err)
        } else if (!userID) {
            // fatal error
        } else {
            var params = {
                TableName: "Notification",
                KeyConditionExpression: "recipientID = :r",
                ExpressionAttributeValues: {
                    ":r": {
                        "S": userID 
                    }
                }
            }
            db.query(params, function(err, data) {
                if (err) {
                    console.log(err)
                    callback(err, null)
                } else if (data.Items == null) {
                    // no notification
                    callback(err, data)
                } else {
                    
                    rowsOfUserInfos = []

                    for (var i = 0; i < data.Items.length; i++) { 
                        var currentDict = data.Items[i]
                        
                        
                        var params = {
                            TableName: "Accounts",
                            Key: {
                                'userID': {
                                    "S": currentDict.senderID.S
                                }
                            }
                        }
                        

                        var queryFunction = function(data, err) {
                            rowsOfUserInfos.push(data)
                        }

                        rowsOfUserInfos.push(db.getItem(params).promise());
                    }
        
                    myListOfItems = []

                    Promise.all(rowsOfUserInfos).then(
                        (myData) => {


                            for (var i = 0; i < data.Items.length; i++) {
                               
                                var currentDict = data.Items[i]
                                
                                
                                if (currentDict.notificationType.S == "friendRequest") {
                                    
                                    var newItem = {
                                        "notifType" : currentDict.notificationType.S, 
                                        "recipientID" : currentDict.recipientID.S, 
                                        "senderID": currentDict.senderID.S,
                                        "senderUsername" : myData[i].Item.username.S,
                                        "timestamp" : currentDict.timestamp.S
                                    }
                                } else if (currentDict.notificationType.S == "chatRequest") {

                                    console.log("hello world")
                                    var newItem = {
                                        "notifType" : currentDict.notificationType.S, 
                                        "recipientID" : currentDict.recipientID.S, 
                                        "senderID": currentDict.senderID.S,
                                        "senderUsername" : myData[i].Item.username.S,
                                        "timestamp" : currentDict.timestamp.S,
                                        "chatID": currentDict.chatID.S
                                    }
                                }             
                                myListOfItems.push(newItem)
                            }
                            
                            Promise.all(myListOfItems).then(
                                (myList) => {
                                    
                                    myList.sort((a, b) => b.timestamp - a.timestamp)
                                    callback(err, myList)
                                }
                            )
                        }
                    )
                }
            })
        }
    })
}


/* This will get all the friends of a given userID */
var getFriends = function(userIDWhoseFriendsAcquired, callback) {
    var params = {
        TableName: "Friends",
        KeyConditionExpression: "followerID =:f",
        ExpressionAttributeValues: {
            ":f" : {
                "S": userIDWhoseFriendsAcquired
            }
        }
    }
    
    db.query(params, function(err, data) {
        if (err) {
            console.log(err)
            callback(err, null)
        } else {
			console.log("getFriends query result", data);
            callback(err, data)
        }
    })

}

/* This will get the friends of the main user*/
var getVisualizer = function(username, callback) {
    rootDB.getUserID(username, function(err, userID) {
        if (err) {
            callback(err, null)
        } else if (!userID) {
            // messed up big time
        } else {
            
            // PROBABLY SHOULD GET ORIGINAL USER'S AFFLIATION BASED ON USER ID
            rootDB.getUserInfoFromID(userID, function(err, data) {
                if (err) {
                    callback(err, null)
                } else if (!data) {
                    // messed up big time
                    callback(err, data)
                } else {
                    console.log("MY DATA IS", data)
                    var affliation = data.Item.affiliation.S
                    var username = data.Item.username.S
                    var fullname = data.Item.firstName.S + " " + data.Item.lastName.S

                    getFriends(userID, function(err, data) {
                        if (err) {
                            callback(err, null)
                        } else {
                            console.log("my friends are", data)
                            var rowsOfUserInfos = []
                            // each identity will have 1. id 2. friends 3. affliation
                            for (var i = 0; i < data.Items.length; i++) {
                                var currentDict = data.Items[i]
                                
                                var params = {
                                    TableName: "Accounts",
                                    Key: {
                                        'userID': {
                                            "S": currentDict.followedID.S
                                        }
                                    }
                                }
                                
                                rowsOfUserInfos.push(db.getItem(params).promise());
                            }
        
                            var myDict = {}
                            var nodes = []
                            var edges = []
                            nodes.push({id: userID, label: fullname, affliation: affliation})
                            
                            Promise.all(rowsOfUserInfos).then (
                                (myData) => {
        
                                    for (var i = 0; i < data.Items.length; i++) {
                                       
                                        var currentDict = data.Items[i]
                                        
                                        var newNode = {
                                            id : currentDict.followedID.S, 
                                            affliation: myData[i].Item.affiliation.S,
                                            label: myData[i].Item.firstName.S + " " 
                                            + myData[i].Item.lastName.S,
                                        }
                                        nodes.push(newNode)

                                        var newEdge = {
                                            from: userID, to: currentDict.followedID.S 
                                        }
                                        edges.push(newEdge)
                                    }
                                    
                                    //POTENTIALLY FIX THIS??
                                    Promise.all(nodes).then(
                                        (nodes) => {
                                            myDict.nodes = nodes
                                            myDict.edges = edges
                                            callback(err, myDict)
                                        }

                                    )
                
                                }
                                
                            )
                            
                        }
                    })
                }
            })
            
        }
    })
}

/* This function gets and display the friend node who share the same
affliation with the main node. It also looks for possible friend
connections with the existing nodes. */
var getMoreFriends = function(myNodes, friendID, username, callback) {
    rootDB.getUserID(username, function(err, userID) {
        if (err) {
            callback(err, null)
        } else if (!userID) {

        } else {
            
            rootDB.getUserInfoFromID(userID, function(err, data) {
                if (err) {
                    callback(err, null)
                } else if (!data) {

                } else {
                    
                    var affiliation = data.Item.affiliation.S
                    getFriends(friendID, function(err, data) {
                        if (err) {
                            callback(err, null)
                        } else if (!data.Items) {

                        } else {
                            var setOfExistingNodes = new Set()
                            

                            for (var i = 0; i < myNodes.length; i++) {
                                setOfExistingNodes.add(myNodes[i].id)
                            }

                            var myResult = {}
                            var nodes = []
                            var edges = []

                            var myListOfQualifiedUser = []

                            Promise.all(setOfExistingNodes).then(
                                () => {
                                    
                                    console.log(affiliation)
                                    for (var j = 0; j < data.Items.length; j++) {
                                        var currentDict = data.Items[j]
                                        if (setOfExistingNodes.has(currentDict.followedID.S)) {
                                            console.log("no new things found")
                                        } else {
                                            console.log("new potential string found!")
                                            var paramsToQueryAccount = {
                                                TableName: "Accounts", 
                                                KeyConditionExpression: "userID =:u",
                                                FilterExpression: "affiliation = :a",
                                                ExpressionAttributeValues : {
                                                    ":u": {
                                                        "S": currentDict.followedID.S
                                                    },
                                                    ":a": {
                                                        "S": affiliation
                                                    }
                                                }
                                            }
                                            myListOfQualifiedUser.push(db.query(paramsToQueryAccount).promise())

                                        }
                                    }

                                    Promise.all(myListOfQualifiedUser).then(
                                        (myListOfQualifiedUser) => {
                                            console.log("LINE 483")
                                            for (var k = 0; k < myListOfQualifiedUser.length; k++) {
                                                var mycurrentdict = myListOfQualifiedUser[k]
                                                
                                                if (mycurrentdict.Items[0]) {
                                                    if (!setOfExistingNodes.has(mycurrentdict.Items[0].userID.S && friendID != mycurrentdict.Items[0].userID.S)) {
                                                        
                                                        var newNode = {
                                                            id : mycurrentdict.Items[0].userID.S,
                                                            label: mycurrentdict.Items[0].firstName.S + " " + mycurrentdict.Items[0].lastName.S
                                                        }
                                                        nodes.push(newNode)

                                                        var newEdge = {
                                                            from: friendID, to: mycurrentdict.Items[0].userID.S
                                                        }
                                                        
                                                        console.log("I added", newEdge)
                                                        edges.push(newEdge)
                                                        
                                                    }
                                                    
                                                }
                                                
                                            }

                                            console.log("HOW MANY NODES THERE ARE", setOfExistingNodes)
                                            var checkingConnectionWithExisting = []
                                            Promise.all(nodes).then(
                                                (nodes) => {
                                                    // myResult.nodes = nodes 
                                                    //myResult.edges = edges 
                                                    // callback(err, myResult)
                                                    
                                                    // add edges to the existing vertices
                                                    for (var z = 0; z < myListOfQualifiedUser.length; z++) {
                                                        var mycurrentdict1 = myListOfQualifiedUser[z]
                                                        
                                                        for (let myKey of setOfExistingNodes) {
                                                            if (mycurrentdict1.Items[0]) {
                                                                var lookingForFriendsParams = {
                                                                
                                                                    TableName: "Friends", 
                                                                    Key: {
                                                                        'followerID': {
                                                                            "S": mycurrentdict1.Items[0].userID.S
                                                                        }, 
                                                                        'followedID': {
                                                                            "S": myKey
                                                                        }
                                                                    }
                                                                }
    
                                                                checkingConnectionWithExisting.push(db.getItem(lookingForFriendsParams).promise())
                                                            }
                                                        }
                                                        
                                                    }
                                                    
                                                   
                                                    Promise.all(checkingConnectionWithExisting).then(
                                                        (checkingConnectionWithExisting) => {
                                                            console.log("I AM HEREsdlfjsdlfhl")
                                                            console.log(checkingConnectionWithExisting)
                                                            for (var m = 0; m < checkingConnectionWithExisting.length; m++) {
                                                                var idkWhatToName = checkingConnectionWithExisting[m]
                                                                console.log(idkWhatToName.Item)


                                                                if (idkWhatToName.Item && friendID != idkWhatToName.Item.followedID.S) {
                                                                    var newEdge = {
                                                                        from: idkWhatToName.Item.followedID.S, 
                                                                        to: idkWhatToName.Item.followerID.S,
                                                                    }
                                                                    console.log("NEW EDGES", newEdge)
                                                                    edges.push(newEdge)
                                                                }
                                                            }
                                                            Promise.all(edges).then( () => {
                                                                myResult.nodes = nodes 
                                                                myResult.edges = edges 
                                                                callback(err, myResult)
                                                            })
                                                            
                                                        }
                                                    )
                                                    
                                                    

                                                }
                                            )
                                        
 
                                        }
                                    )
                                }
                            )
                            
                            
                        }
                    })

                }
            })
        }
    })
}



var friendDatabase = {
    addFriend: addFriend, 
    getFriend: getFriend,
    getNotifications: getNotifications,
    acceptFriendRequest: acceptFriendRequest,
    getVisualizer: getVisualizer,
    getMoreFriends: getMoreFriends,
    getFriends: getFriends,
}

module.exports = friendDatabase;
