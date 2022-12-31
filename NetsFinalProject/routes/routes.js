var db = require('../models/database.js');
var friendDB = require('../models/friendDatabase.js');


var login = function(req, res) {
	res.render('login.ejs', {message: req.session.messageHomepage});
}

// creates a new user
var createAccount = function(req, res) {
	var username = req.body.username;
	var firstName = req.body.fname; 
	var lastName = req.body.lname; 
	var email = req.body.email;
	var password = req.body.password; 
	var affiliation = req.body.affiliation; 
	var birthDate = req.body.birthDate;
	var interest = req.body.interest;
	console.log(interest);
	//console.log(req.body);

	db.addUser(username, firstName, lastName, email, password, affiliation, birthDate, interest, function(err, data) {
		if (err) {
			console.log(err);
		} else if (data){
			console.log("DATA: ", data)
			res.send({success: false});
		} else {
			console.log("successful account creation")
			req.session.username = username;
			res.send({success: true, url: '/homePage'});
		}
	})
}

// retrieves all information on a user except for their password
var getUserInfo = function(req, res) {
	//console.log(req.session)
	console.log("current visiting user: ", req.session.visitinguser);
	db.getUserInfo(req.session.visitinguser, function(err, data) {
		//console.log(data.Item.firstName.S);
		data.Item.password = null;
		res.send(data);
	})
}


var getSelfInfo = function(req, res) {
	//console.log(req.session)
	console.log("current user: ", req.session.username);
	db.getUserInfo(req.session.username, function(err, data) {
		//console.log(data.Item.firstName.S);
		console.log("Self info user: ", data.Item.username.S);
		data.Item.password = null;
		res.send(data);
	})
}

// renders the homepage (a user's own wall)
var homePage = function(req, res) {
	if (req.session.username) {
		req.session.visitinguser = req.session.username;
		res.render('homepage.ejs')
	} else {
		res.redirect('/');
	}
}

// authenticates a user and logs them in
var checkLogin = function(req, res) {
	db.checkLogin(req.body.username, req.body.password, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false})
		} else if (!data) { // data == null
			console.log('invalid login credentials')
			res.send({success: false})
		} else {
			req.session.username = req.body.username;
			res.send({success: true, url: '/homePage'})
		}
	})
}

// requires a user parameter (to get the posts for)
// returns data (subset of posts) and boolean for if this is the last batch of posts for infinite scrolling
var getPosts = function(req, res) {
	//console.log("USERNAME IN GET POSTS:", req.session.visitinguser)
	var minIndex = req.query.minPostIndex;
	var maxIndex = req.query.maxPostIndex;
	if(!minIndex || !maxIndex) {
		minIndex = 0;
		maxIndex = 20;
	}
	console.log(req.query);
	console.log("USERNAME in GETPOSTS", req.query.username);
	db.getPosts(req.query.username, minIndex, maxIndex, function(err, data) {
		if (err) {
			console.log(err)
		} else {
			//console.log("SERVER SIDE GETPOSTS DATA", data);
			
			if (req.query.updatePostCall) {
				var topID;
				if (data.result[0]) {
					topID = data.result[0].postID;
				}
				console.log("UPDATE POST CALL TOP ID: ", topID);
				res.send(JSON.stringify({topID: topID, numPosts: data.numPosts}));
			} else {
				// is last post if maxIndex is greater than data length
				data.result.sort(function(a, b) {
					return b.timestamp.N - a.timestamp.N;
				})
				isLastPost = req.query.maxPostIndex >= data.numPosts; // have to convert to an int?
				console.log("comparison: ", req.query.maxPostIndex, data.length);
				console.log("ISLASTPOST: ", isLastPost);
				res.send(JSON.stringify({data: data.result, isLastPost: isLastPost, numPosts: data.numPosts}))
			}
			
		}
	})
}

// retrieves suggestions for the user search bar
var getSearchResult = function(req, res) {
	
	var searchName = req.body.searchName
	db.getSearchResult(searchName, function(err, data) {
		if (err) {
			console.log(err)
			res.send(JSON.stringify({status: false, list: null}))
		} else if (data) {

		
			// var contentString = '<ul style="list-style: none;">'
			var listOfLi = []
			for (var i = 0; i < data.length; i++) {
				let theString = "/user/" + data[i]
				listOfLi.push('<li>' + '@' + '<a href=' + theString + '>' + data[i] + '</a> </li>')
				
			}
			// contentString += '</ul>'
			//res.send(JSON.stringify({list: data}))
			res.send(JSON.stringify({status: true, list: listOfLi}))




		} else {
			res.send(JSON.stringify({status: true, list: null}))
		}
	})
}

var getUserInfoFromID = function(req, res) {
		db.getUserInfoFromID(req.body.userID, function(err, data) {
			if (!data) {
				console.log("error getting user info from id");
			} else {
				return res.send({info: data.Item})
			}
		})
}


// renders the account changes page
var accountChange = function(req, res) {
	if (req.session.username) {
		res.render('accountchange.ejs', {user: req.session.username});
	} else {
		res.redirect('/')
	}
}

//Get the current user and create a post given the content and the user for which the post is to
var addPost = function(req, res) {
	var creator = req.session.username
	console.log("Creator: ", creator);
	db.addPost(req.body.username, creator, req.body.content, function(err, data) {
		if (err) {
			console.log("error adding post", err);
		} else {
			console.log("Adding post", data);
			res.send({success: true, data: data});
		}
	});
}

// update a user's account information
var updateAccount = function(req, res) {
	console.log("User is updating account");
	//Get inputs from body
	var uid = req.body.userID;
	var username = req.body.username;
	var oldUsername = req.session.username;
	var email = req.body.email;
	var password = req.body.password; 
	var affiliation = req.body.affiliation; 

	//Call db method
	db.updateAccount(oldUsername, uid, username, email, password, affiliation, function(err, data) {
		if (err) {
			console.log("error updating account information");
			res.send({success: false});
		} else {
			console.log("successful account update");
			req.session.username = username;
			res.send({success: true});
		}
	})
}

// renders the wall of a user other than yourself
var renderOtherUserPage = function(req, res) {
	if (req.session.username) {
		console.log('want to lookup' + req.params.user)
		req.session.visitinguser = req.params.user
		// check if user name is legit
		db.getUserID(req.session.visitinguser, function(err, data) {
			if (err) {
				console.log("getuserid error", err);
			} else if (data) {
				console.log(req.session);
				res.render('otheruserpage.ejs');
			} else {
				// user does not exist
				res.render('usernotfound.ejs');
			}
		})
	} else {
		res.redirect('/');
	}
	
	
}

// gets information about another user (to be displayed on their wall)
var getOtherUserPage = function(req, res) {
	var username = req.session.visitinguser 
	console.log(username)
	db.getUserInfo(username, function(err, data) {
		console.log("my data", data)
		res.send(data);
	})
}

// adds a comment to the database, takes in a postID and the comment content
var addComment = function(req, res) {
	console.log(req.session.username);
	
	db.addComment(req.body.postID, req.session.username, req.body.content, function(err, data) {
		if(err) {
			console.log(err);
		} else {
			db.getComments(req.body.postID, function(err, data) {
				if (err) {
					console.log(err);
				} else {
					console.log("comment data", data);
					res.send({success:true, newComment: data[0]});
				}
				
			})
		}
	});
}


// retrieves comments for a particular post, takes in a PostID as input
var getComments = function(req, res) {
	console.log("POSTID: ", req.query.postID);
	db.getComments(req.query.postID, function(err, data) {
		if (err) {
			console.log("GETCOMMENTS ERROR", err);
		} else {
			console.log("data", data);
			// add userID attribute to each element in array
			// sort comments by time
			data.sort((a, b) => b.timestamp - a.timestamp);
			res.send(data);
		}
	});
}

// gets friend request notifications
var getNotifications = function(req, res) {
	var userName = req.session.username 
	friendDB.getNotifications(userName, function(err, data) {
		// send something back to client please 
		if (err) {
			var content = {
                "success": false, 
                "data" : null
            }
			res.send(JSON.stringify(content))
		} else {
			data.slice(0, 20);
			var content = {
				"success": true, 
				"data": data
			} 
			res.send(JSON.stringify(content))
		}
	})
}

// adds a like to a particular post in the database
var addLike = function(req, res) {
	db.addLike(req.body.postID, req.session.username, function(err, data) {
		if(err) {
			console.log(err);
			res.send({success: false});
		} else {
			res.send({success: true});
		}
	})
}

// gets number of likes and returns if the user has already liked the item
var getLikes = function(req, res) {
	db.getLikes(req.query.postID, req.session.username, function(err, likesCount, alreadyLiked) {
		if (err) {
			console.log(err);
		} else {
			res.send({numLikes: likesCount, alreadyLiked: alreadyLiked})
		}
	})
}

// removes a like from a particular post
var removeLike = function(req, res) {
	db.removeLike(req.body.postID, req.session.username, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			console.log(data);
			res.send({success: true});
		}
	})
}

// renders the friends feed (homepage), which consists of posts made by a user's friends
var getRealHomepage = function(req, res) {
	if (req.session.username) {
		req.session.visitinguser = req.session.username;
		console.log("REAL HOMEPAGE", req.session);
		res.render("friendsfeed.ejs");
	} else {
		// not logged in
		res.redirect('/');
	}
}

// retrieves posts for the friends feed/homepage
var getFriendsPosts = function(req, res) {
	// get user's friends. then get those friends' posts and sort by time
	console.log("SESSION USERNAME: ",  req.session.username);
	console.log(req.query);
	db.getUserID(req.session.username, function(err, userid) {
		if(err) {
			console.log(err);
		} else {
			console.log("USERID: ", userid);
			friendDB.getFriends(userid, function(err2, friendIDs) {
				if (err2) {
					console.log(err2);
				} else {
					friendIDs = friendIDs.Items.map(e => e.followedID.S);
					console.log(friendIDs);
					//have to handle duplicate postIDs
					db.getMultiplePosts(friendIDs, req.query.minPostIndex, req.query.maxPostIndex, function(err, data) {
						if (err) {
							console.log("getMultiplePosts Error", err);
						} else {
							// console.log(data);
							data.posts.sort(function(a, b) {
								return b.timestamp.N - a.timestamp.N;
							})
							isLastPost = req.query.maxPostIndex >= data.numPosts; // have to convert to an int?
							console.log("comparison: ", req.query.maxPostIndex, data.length);
							console.log("ISLASTPOST: ", isLastPost);
							res.send(JSON.stringify({data: data.posts, isLastPost: isLastPost, numPosts: data.numPosts}))
							
						}
					});
				}
			})
		}
	})
}

// renders the newsfeed - OUTDATED/NOT USED ANYMORE
var renderNewsfeed = function(req, res) {
	if (req.session.username) {
		res.render("newsfeed.ejs");
	} else {
		res.redirect('/');
	}
}


// OUTDATED - NOT USED ANYMORE
var renderMePlease = function(req, res) {
	res.render('homePage2.ejs')
}

// logs a user out of their account and resets all of the cookies
var logout = function(req, res) {
	console.log(req.session);
	req.session.username = null;
	//req.session.visitinguser = null;
	res.redirect('/');
}

// OUTDATED/NOT USED ANYMORE
var renderRealHP = function(req, res) {
	res.render("therealhomepage.ejs");
}


// removes all prefixes of a username from the user search bar prefix table
var deleteUserIDFromPrefixTable = function(req, res) {
	var userID = req.body.userID 
	var oldUsername = req.body.oldUsername
	var newUsername = req.body.newUsername
	console.log(oldUsername)
	console.log(newUsername)
	db.deleteUserIDFromPrefixTable(userID, oldUsername, newUsername, function(err, data) {
		if (err) {
			res.send({err: true})
		} else {
			res.send({err: false})
		}
	})
}

// retrieves the number of friends a user has. used for display on a user's wall
var getNumFriends = function(req, res) {
	console.log("getNumFriends", req.session.visitinguser);
	db.getUserID(req.session.visitinguser, function(err, userid) {
		console.log(userid);
		friendDB.getFriends(userid, function(err, data) {
			if (err) {
				console.log(err);
			} else {
				// console.log("getNumFriends data", data);
				res.send({numFriends: data.Items.length});
			}
		})
	})
}


var routes = {
	login: login,
	createAccount: createAccount,
	homePage: homePage,
	getUserInfo: getUserInfo,
	getPosts: getPosts,
	getUserInfoFromID: getUserInfoFromID,
	getSearchResult: getSearchResult,
	checkLogin: checkLogin,
	accountChange: accountChange,
	addPost: addPost,
	updateAccount: updateAccount,
	getOtherUserPage: getOtherUserPage, 
	renderOtherUserPage: renderOtherUserPage,

	
	addComment: addComment,
	getComments: getComments,

	getNotifications: getNotifications,
	
	addLike: addLike,
	getLikes: getLikes,
	removeLike: removeLike,
	
	getRealHomepage: getRealHomepage,
	getNewsfeed: renderNewsfeed,
	getFriendsPosts: getFriendsPosts,
	logout: logout,


	// to be deleted 
	renderMePlease: renderMePlease,
	renderTheRealHomepage: renderRealHP,

	deleteUserIDFromPrefixTable: deleteUserIDFromPrefixTable,
	getNumFriends: getNumFriends,
	getSelfInfo: getSelfInfo,
}

module.exports = routes;