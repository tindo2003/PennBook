/* Some initialization boilerplate. Also, we include the code from
   routes/routes.js, so we can have access to the routes. Note that
   we get back the object that is defined at the end of routes.js,
   and that we use the fields of that object (e.g., routes.get_main)
   to access the routes. */

var express = require('express');
var routes = require('./routes/routes.js');
var newsRoutes = require('./routes/newsRoutes');
var chatRoutes = require('./routes/chatRoutes');
var friendRoutes = require('./routes/friendRoutes')
var visualizerRoutes = require('./routes/visualizerRoutes')

var async = require("async");
var app = express();

var SHA3 = require("crypto-js/sha3");
//const http = require('http').Server(app);
// const http = require('http');
const path = require("path");
// const io = require('socket.io')(http);

const http = require('http');
const url = require('url');
const fs = require('fs');




const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

var session = require('express-session')
app.use(session({secret:'loginSecret'}))
app.use(express.urlencoded());
//app.use(express.bodyParser());
//app.use(__dirname, express.static('public'));
// app.use("/assets", express.static(__dirname + "/public"));

// experiment lmaooo 
app.use(express.static(path.join(__dirname, 'public')))

// app.use('/renderMePlease', express.static("public"));



app.get('/', routes.login);
app.post('/createAccount', routes.createAccount);
app.get('/homePage', routes.homePage);
app.get('/getUserInfo', routes.getUserInfo);
app.get('/getPosts', routes.getPosts);
app.post('/login', routes.checkLogin);
app.get('/accountChange', routes.accountChange);
app.post('/addPost', routes.addPost);
app.post('/updateAccount', routes.updateAccount);

app.post('/deleteUserIDFromPrefixTable', routes.deleteUserIDFromPrefixTable)
app.get('/getSelfInfo', routes.getSelfInfo);



app.post('/getSearchResult', routes.getSearchResult)
app.get('/user/:user', routes.renderOtherUserPage)
app.get('/getOtherUserPage', routes.getOtherUserPage)

app.get("/chatRoom", chatRoutes.joinRoom);
app.post('/logMessage', chatRoutes.logMessage);
app.get('/chats', chatRoutes.getChatRooms);


// friend 
app.post('/addFriend', friendRoutes.addFriend);
app.get('/getNotifications', routes.getNotifications)
app.post('/acceptFriendRequest', friendRoutes.acceptFriendRequest)

app.post('/acceptChatInvite', chatRoutes.acceptChatInvite)
app.post('/rejectChatInvite', chatRoutes.rejectChatInvite)


// visualizer
app.get('/friendvisualization', visualizerRoutes.getFriendVisualizer)
app.get('/visualize', function(req, res) {
   res.render('visualize.ejs')
})

app.post('/getMoreFriends', visualizerRoutes.getMoreFriends)
app.get('/searchNews', newsRoutes.searchNews)
app.post("/likeArticle", newsRoutes.likeArticle);
app.post("/createInterest", newsRoutes.createInterest);
app.get("/getInterests", newsRoutes.getInterests);
app.post("/deleteInterests", newsRoutes.deleteInterests);
app.get("/getRecArticle", newsRoutes.getRecArticles);
app.post("/deleteLikedArticle", newsRoutes.deleteLikedArticle)
app.get("/logout", routes.logout);
app.post("/setInterestSession", newsRoutes.setInterestSession);


 var online = new Set();
//Socket io for chat
io.on("connection", (socket) => {
   //For each online user, keep their userID and roomID
   var userID;
   var roomID;

   //Simply pass back any chat messages
   socket.on("chat message", obj => {
      io.to(obj.room).emit("chat message", obj);
   });

   //If joing room, set the roomID to the obj.room and then actually join the room
   socket.on("join room", obj => {
      socket.join(obj.room);
      roomID = obj.room;
      console.log("joined room: ", roomID);
   });

   //Leave the room
   socket.on("leave room", obj => {
      console.log("left room");
      socket.leave(obj.room);
   });

   //Add user to global array of online users, and also set the userID
   socket.on("login", obj => {
      online.add(obj.user);
      userID = obj.user;
      console.log("Logged in registered on socket for user: ", userID);
   });

   //Pass back the global list of online users
   socket.on("online", obj => {
      socket.emit("online", Array.from(online));
   });

   //Remove user from list on disconnect
   socket.on("disconnect", obj => {
      console.log("Logging off: ", userID);
      online.delete(userID);
      socket.emit("online", Array.from(online));
      if (roomID) {
         console.log("left room");
         socket.leave(roomID);
      }
   });
});

app.post('/addComment', routes.addComment);
app.get('/getComments', routes.getComments);
app.post("/addLike", routes.addLike);
app.get("/getLikes", routes.getLikes);
app.post('/removeLike', routes.removeLike);

app.get("/friendsfeed", routes.getRealHomepage);
app.get("/getFriendsPosts", routes.getFriendsPosts);

app.get("/newsfeed", routes.getNewsfeed);

app.post("/getOnlineFriends", chatRoutes.getOnlineFriends);
app.post("/addUserToChatRoom", chatRoutes.addUserToChatRoom);
app.post("/createChatRoom", chatRoutes.createChatRoom);


// to be deleted 
app.get('/renderMePlease', routes.renderMePlease)
app.get('/therealhomepage', routes.renderTheRealHomepage)
app.get('/getNumFriends', routes.getNumFriends);
// 
//app.listen(8080);
server.listen(8080, () => {
   console.log('Server running on port 8080. Now open http://localhost:8080/ in your browser!');
});
console.log("Directory", __dirname);