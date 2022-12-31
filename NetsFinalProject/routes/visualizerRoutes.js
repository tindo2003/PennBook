// returns set of all friends of a user
var friendDB = require('../models/friendDatabase.js');


var getFriendVisualizer = function(req, res) {
    
    var username = req.session.visitinguser;
    console.log("my name is", username)

    friendDB.getVisualizer(username, function(err, data) {
        // SEND BACK JSON
        if (err) {
            // send error
        } else {
            // no friend
            if (data == null) {

            } else {
                res.send(data)
            }
        }
    })
    
}

var getMoreFriends = function(req, res) {
    var username = req.session.visitinguser;
    var  friendID = req.body.friendID;
    var myNodes = req.body.myNodes
     
    friendDB.getMoreFriends(myNodes, friendID, username, function(err, data) {
        if(err) {
            // send error please
        } else {
            res.send(data)
        }
    })
}



var routes = {
    getFriendVisualizer: getFriendVisualizer,
    getMoreFriends: getMoreFriends
}

module.exports = routes;