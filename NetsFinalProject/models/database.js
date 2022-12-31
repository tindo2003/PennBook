var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
const { v4: uuidv4 } = require('uuid');
var SHA3 = require('crypto-js/sha3');
const { map } = require('async');
const { data } = require('vis-network');

/**
* use distinct user id to get the password from the Account database
* @param {String} username passed in from the routes.js
* @param {Function} callback a callback function to routes.js 
 */
var checkLogin = function(username, password, callback) {
	getUserID(username, function(err, userID) {
		if(err) {
			console.log("GETUSERID ERROR", err)
			callback(err, null)
		} else if (!userID) { //username doesn't exist
			console.log('username doesnt exist')
			callback(err, null)
		} else {
			var hashedPassword = SHA3(password).toString();
			var params = {
				Key: {
					"userID": {
						"S": userID
					}
				},
				TableName: "Accounts",
				AttributesToGet: [ 'password' ]
			}
			db.getItem(params, function(err, data) {
				if (err) {
					callback(err, null)
				} else if (!data.Item || data.Item.password.S != hashedPassword) { // username does not exist or invalid password
					console.log('wrong password')
					console.log(hashedPassword);
					callback(err, null)
				} else { 
					callback(err, data.Item.password.S)
				}
			})
		}
	})
	
}

/**
* add a new user to the Accounts table and add the user's news interest to the NewsInterests table
 */
var addUser = function(username, fname, lname, email, password, affiliation, birthday, newsInterest, callback) {
	// generate unique user id
	var uid = uuidv4();
	var hashedPassword = SHA3(password).toString();
	getUserID(username, function(err, data) {
		if (err) {
			console.log("CHECK USERNAME ERROR: ", err);
		} else if (data) { // username already exists
			console.log("Data is ", data)
			callback(err, data);
		} else { // username does not exist, add them into the database
			console.log('adding user....');
			var params = {
				TableName: "Accounts",
				Item: {
					'userID': {S: uid},
					'firstName': {S: fname},
					'lastName': {S: lname},
					'email': {S: email},
					'password': {S: hashedPassword},
					'affiliation': {S: affiliation},
					'birthday': {S: birthday},
					'username': {S: username}
				}
			}
			db.putItem(params, function(err, data) {
				if (err) {
				
				} else {
					console.log("added user to accounts db");
					var newsParams = {
						TableName: "NewsInterests",
						Item: {
							'userID': {S: uid},
							'category': {S: newsInterest}
						}
					}
					console.log(uid, newsInterest);
					db.putItem(newsParams, function(err, res) {
						if (err) {
							console.log('put news error', err);
						} else {
							console.log('no error??', res);
							db.putItem({TableName: "Usernames",Item: {'username': {S: username}, 'userID': {S: uid}}}, function(err, data) {
								async function performAction() {
									// make array from 1, 2, 3, ..., username length
									const myArray = Array.from({length: username.length}, (_, i) => i + 1);
									
									// add the username prefixes into the prefix table
									for (const index of myArray) {
										
										await updateItemBasedOnUserName(username, index, uid)
									}
								}
								performAction();					

								callback(err, null);
							})
						}
					})
				}
			})
			
			/*function addInterest(newsInterest) {
				var params =  {
					TableName: "NewsInterests", 
					Item: {
						'userID': {
							'S': uid
						},
						'category': {
							'S': newsInterest
						}
					}
				}
		
				return db.putItem(params).promise()
				
			}

			var arrayOfPromises1 = listOfInterests.map(addInterest)
			
			Promise.all(arrayOfPromises1).then(
				db.putItem(params, function(err, data) {
				
					// add the username to the username -> id table
					db.putItem({TableName: "Usernames",Item: {'username': {S: username}, 'userID': {S: uid}}}, function(err, data) {
						// callback(err, null);
					})
					
					// 
					async function performAction() {
						// make array from 1, 2, 3, ..., username length
						const myArray = Array.from({length: username.length}, (_, i) => i + 1);
						
						// add the username prefixes into the prefix table
						for (const index of myArray) {
							
							await updateItemBasedOnUserName(username, index, uid)
						}
					}
					performAction();					
				})
			)*/
			// TODO: deal with error
		}
	})
}


	
// return a promise 
async function getUserIDsFromPrefix(myPrefix) {
	console.log("reachedlol")
	var params = {
		TableName: "Prefix",
		Key: {
			'prefix' : {
				"S": myPrefix
			} 
		},
		AttributesToGet: ['userIDs']
	}
	
	await doThis(params);
	
}
	
//Update account information, create status update if affiliation is changed
var updateAccount = function(oldUsername, uid, username, email, password, affiliation, callback) {
	// retrieve unique user id, proceed only if the user already exists
	getUserID(oldUsername, function(err, data) {
		if (err) {
			console.log("CHECK USERNAME ERROR: ", err);
		} else if (data) { // old username exists
			getUserID(username, function(err, data) {
				if (err) {
					console.log(err);
				} else if (data && oldUsername != username) { //New username already in use
					console.log("New username already in use ", data)
					callback(err);
				} else {
					getUserInfo(oldUsername, function(e, oldInfo) {
						if (e) {
							console.log(e);
						} else {
							// if no input was made, then just make the old password the new password
							if (password == "") {
								password = oldInfo.Item.password.S;
							} else { // hash the new password
								password = SHA3(password).toString();
							}
							console.log("New username is valid");
							var params = { //New username not is use, proceed
								TableName: "Accounts",
								Key: {
									userID: {S: uid},
								},
								UpdateExpression: 'set username = :un, email = :em, password = :pw, affiliation = :af',
								ExpressionAttributeValues: {
									':un': {S: username},
									':em': {S: email},
									':pw': {S: password}, 
									':af': {S: affiliation}
								}
							}
							//Update the item in the accounts table
							db.updateItem(params, function(err, data) {
								if (err) {
									callback(err);
								} else {
									//if the username was changed, then also update the usernames table
									if (oldUsername != username) {
										var params2 = {
											TableName: "Usernames",
											Key: {
												username: {S: oldUsername},
											}
										}
										//delete old entry
										db.deleteItem(params2, function(err, dataa) {
											if (err) {
												callback(err);
											} else {
												// add the username to the username -> id table
												db.putItem({TableName: "Usernames",Item: {'username': {S: username}, 'userID': {S: uid}}}, function(err, data) {
													console.log("Successfully updated username");
													callback(null, dataa);
												});
											}
										});
									} else {
										console.log("Succesfully updated user information");
										callback(null, data);
									}
								}
							})
						}
					})
				}
			})
		} else {
			console.log("user doesn't exist, please create account first")
		}
	})
}


async function doThis(params) {
	db.getItem(params, function(err, data) {
	console.log("yooooooo")
	if (err) {
		console.log("i was here")
		return {err: true, data: null}
	} else if (data.Item) {
		console.log("i was here1")
		return {err: false, data: data.Item.userIDs}
	} else {
		console.log("i was here2")
		return {err: false, data: null}
	}
	})
}
	

// adds a username to the prefix table
// called as a helper function to addUser
async function updateItemBasedOnUserName(username, index, uid) {
	
	var myPrefix = username.substring(0, index).toLowerCase()
	
	// check for the result 
	let result = getUserIDsFromPrefix(myPrefix);
	
	
	if (result.err) {
		console.log("database/updateItemBasedOnUserName/" + err);
	} else { // prefix exists or not doens't really matter lol 
		var prefixParams = {
			TableName: "Prefix",
			// getItem with key as a prefix of the string. 
			Key: {
				'prefix': {S: myPrefix}
			},
			UpdateExpression: "ADD userIDs :u",
			ExpressionAttributeValues: {
				":u": {
					"SS": [uid]
				}
			},
			ReturnValues: "ALL_NEW"
		}
		let b = await pleaseUpdateItem(prefixParams)
		async function pleaseUpdateItem(prefixParams) {
			db.updateItem (prefixParams, function(err, data) {
				if (err) {
					console.log(err);
				} else {
					console.log("no error!!")
				}
			})
		}
	}
}


var getSearchResult = function(searchName, callback) {
	var params = {
		TableName: "Prefix",
		Key: {
			'prefix': {
				"S": searchName
			}
		}, 
		AttributesToGet: ['userIDs']
	} 
	db.getItem(params, function(err, data) {
		
		if (err) {
			console.log("database/getSearchResult", err);
			callback(err, data)
		} else if (data.Item) { // username is in the string 
			if (data.Item.userIDs) {
				const currentData = data.Item.userIDs.SS
				
				
				var myBeautifulList = []
				// change unique ID to userName
				
				function getItemForGetResult(userID) {
					var params = {
						TableName: "Accounts",
						Key: {
							'userID': {
								"S": userID
							}
						},
					}
					
					return db.getItem(params).promise()
				}
				
				var arrayOfPromises = currentData.map(getItemForGetResult)
				
				Promise.all(arrayOfPromises).then(
					successfulDataArray => {
						for (var i = 0; i <  successfulDataArray.length; i++) {
							
							myBeautifulList.push(successfulDataArray[i].Item.username.S)
						}
						callback(err, myBeautifulList)
					}
					
				)
			} else {
				callback(err, null)
			}			
		} else {
			callback(err, null) // username is not in the prefix table
		}
	})
}

// returns getItem of username. return the username if it exists, null otherwise
var getUserID = function(username, usernameCallback) {
	var params = {
		TableName: "Usernames",
		Key: {
			'username': {
				"S" : username
			}
		},
		AttributesToGet: ['userID']
	}

	db.getItem(params, function(err, data) {
		console.log(data);
		if (err) {
			console.log(err);
		} else if (data.Item){
			//console.log("USER EXISTS")
			usernameCallback(err, data.Item.userID.S);
		} else {
			console.log("USERNAME DOESNT EXIST");
			usernameCallback(err, null);
		}
	})
}

/**
gets user info from username
 */
var getUserInfo = function(username, callback) {
	getUserID(username, function(err, userID) {
		if(err) {
			console.log("GETUSERID ERROR")
			callback(err, null)
		} else if (userID) {
			// console.log("userid: ", userID);
			var params = {
				TableName: "Accounts",
				Key: {
					'userID': {
						"S": userID
					}
				},
			}
			db.getItem(params, function(err, data) {
				if(err) {
					console.log("GET ACCOUNT ERROR:", err)
				} else {
					// console.log(data);
				}
				callback(err, data);
			})
		} else { // user doesn't exist'
			console.log('lol');
		}
	})
}

//Get the user info from the userID
var getUserInfoFromID = function(userID, callback) {
			
	var params = {
		TableName: "Accounts",
		Key: {
			'userID': {
				"S": userID
			}
		},
	}

	db.getItem(params, function(err, data) {
		if(err) {
			console.log("GET ACCOUNT ERROR:", err)
			callback(err, null)
		} else {
			// console.log(data);
			callback(err, data)
		}
		
	})
}


var getSuggestions = function(term, data) {
	var params = {
		
	}
}

// Table Posts1: userID (ID of the user wall being written on), postID
// Table Posts2: creatorID (ID of post creator), postID
// if a user posts on their own wall, the post will be added only to post 1 to prevent duplicates
// returns an array of post dictionaries
var getPosts = function(username, minPostIndex, maxPostIndex, callback) {
	console.log("entered getPosts in database.js: ", username);
	var numPosts;
	getUserID(username, function(err, userID) {
		var param1 = {
			TableName: 'Posts1',
			KeyConditionExpression: 'userID = :userID',
			ExpressionAttributeValues: {
				':userID': {'S': userID}
			}
		}
		db.query(param1, function(err, data) {
			//console.log("QUERY 1 data", data);
			if (err) {
				console.log("QUERYING POSTS1 TABLE FAILED", err);
			} else {
				var param2 = {
					TableName: 'Posts2',
					KeyConditionExpression: 'creatorID = :userID2',
					ExpressionAttributeValues: {
						':userID2': {'S': userID}
					}
				}
				db.query(param2, function(err2, data2) {
					//console.log("QUERY 2 DATA: ", data2)
					if (err2) {
						console.log("QUERY IN POSTS2 TABLE FAILED", err2);
					} else {
						if (!data.Items && !data2.Items) {
							console.log("cb 1");
							callback(err2, null)
						} else {
							var result;
							if (!data.Items) {
								result = data2.Items;
							} else if (!data2.Items) {
								result = data1.Items;
							} else {
								result = data.Items.concat(data2.Items);
							}
							numPosts = result.length;
							if (numPosts != 0) {
								result.sort(function(a, b) {
									return b.timestamp.N - a.timestamp.N;
								})
								result = result.slice(minPostIndex, maxPostIndex);
							}
							
							//var wallIDs = result.map(i => i.userID.S);
							//var creatorIDs = result.map(i => i.creatorID.S);
							Promise.all(result.map(function(post) {
								return new Promise (function(resolve, reject){
									var reqParams = {
										TableName: "Accounts",
										Key: {"userID": {
											"S" : post.userID.S
										}}
									};
									db.getItem(reqParams, function(err, userIdData) {
										if (err) {
											console.log("REQPARAMS1 ERROR", err);
											reject(err);
										} else {
											//console.log("post username data: ", userIdData);
											post.username = userIdData.Item.username;
											post.userFirstName = userIdData.Item.firstName;
											post.userLastName = userIdData.Item.lastName;
											resolve(userIdData);
										}
									})
								})
							})).then(function() {
								Promise.all(result.map(function(post) {
									return new Promise (function(resolve, reject){
										var reqParams = {
											TableName: "Accounts",
											Key: {"userID": {
												"S" : post.creatorID.S
											}}
										};
										db.getItem(reqParams, function(err, creatorIdData) {
											if (err) {
												console.log("REQPARAMS2 ERROR", err);
												reject(err);
											} else {
												//console.log("accounts creatorID data", creatorIdData);
												post.creatorUsername = creatorIdData.Item.username;
												post.creatorFirstName = creatorIdData.Item.firstName;
												post.userLastName = creatorIdData.Item.lastName;
												resolve(creatorIdData);
											}
										})
									})
								})).then(function() {
									//console.log("cb 2: has result");
									callback(null, {result: result, numPosts: numPosts});
								}).catch(function(err) {
									console.log("cb 3");						
									callback(err, null);
								})
							}).catch(function(err){
								console.log("cb 4");
								callback(err, null);
							})
						}
					}
				})
			}
		})
		
	})
}

// takes as input friendIDs, an array of userIDs
// retrieves the posts made by a set of users; removes duplicate posts before returning
var getMultiplePosts = function(friendIDs, minPostIndex, maxPostIndex, callback) {
	var posts = [];

	function queryPost1(id) {
		var param = {
			TableName: 'Posts1',
			KeyConditionExpression: 'userID = :userID',
			ExpressionAttributeValues: {
				':userID': {'S': id}
			}
		}
		return db.query(param).promise();
	}
	
	function queryPost2(id) {
		var params = {
			TableName: 'Posts2',
			KeyConditionExpression: 'creatorID = :userID',
			ExpressionAttributeValues: {
				':userID': {'S': id}
			}
		}
		return db.query(params).promise();
	}
	
	var postPromises = friendIDs.map(queryPost1);
	var post2Promises = friendIDs.map(queryPost2);
	postPromises = postPromises.concat(post2Promises);
	//console.log(postPromises);
	
	Promise.all(postPromises).then((result) => {
		// result is an array of the queried post results
		result = result.map(e => e.Items);
		console.log(result);
		
		var flatResult = new Promise((resolve, reject) => {
			result.forEach((value, index, array) => {
				posts = posts.concat(value);
				//console.log("value", value);
				console.log(index, value.length, posts.length);
				if(index === array.length -1) resolve();
			});
		})
		
		var numPosts;
		flatResult.then(() => {
			console.log("POSTS RESULT:", posts);
			console.log(posts.length);
			// sort and assign other information to the posts
			posts = posts.filter((value, index) => {
				const _value = JSON.stringify(value);
				return index === posts.findIndex(obj => {
					return JSON.stringify(obj) === _value;
				});
			});
			console.log("POSTS RESULT2:", posts);
			console.log(posts.length);

			numPosts = posts.length;
			if (posts.length != 0) {
				posts.sort(function(a, b) {
					return b.timestamp.N - a.timestamp.N;
				})
				console.log(minPostIndex, maxPostIndex);
				posts = posts.slice(minPostIndex, maxPostIndex);
			}
			console.log("posts after slice", posts.length);
			
			Promise.all(posts.map(function(post) {
				return new Promise (function(resolve, reject){
					var reqParams = {
						TableName: "Accounts",
						Key: {"userID": {
							"S" : post.creatorID.S
						}}
					};
					db.getItem(reqParams, function(err, creatorIdData) {
						if (err) {
							console.log(err);
							reject(err);
						} else {
							//console.log("accounts creatorID data", creatorIdData);
							post.creatorUsername = creatorIdData.Item.username;
							post.creatorFirstName = creatorIdData.Item.firstName;
							post.userLastName = creatorIdData.Item.lastName;
							//console.log(post);
							resolve(creatorIdData);
						}
					})
				})
			})).then(function() {
				console.log("posts after creator info added", posts);
				Promise.all(posts.map(function(post) {
					return new Promise (function(resolve, reject){
						console.log("a post", post);
						// console.log("post userid", post.userID.S);
						var reqParams = {
							TableName: "Accounts",
							Key: {"userID": {
								"S" : post.userID.S
							}}
						};
						db.getItem(reqParams, function(err, userIdData) {
							if (err) {
								console.log("REQPARAMS1 ERROR", err);
								reject(err);
							} else {
								//console.log("post username data: ", userIdData);
								post.username = userIdData.Item.username;
								post.userFirstName = userIdData.Item.firstName;
								post.userLastName = userIdData.Item.lastName;
								resolve(userIdData);
							}
						})
					})
				})).then(function() {
					console.log("in the then then", posts, numPosts);
					callback(null, {posts: posts, numPosts: numPosts});
				})
			})
		})
	})
}

//User name is the username of the wall which the post is going on, creator name is
//the user name of the creator of the post
var addPost = function(username, creatorname, content, callback) {
	console.log("adding post for: ", username, "created by: ", creatorname);
	var timestamp = Date.now() + "";
	var postID = uuidv4();
	console.log("Generated postID: ", postID, "at time: ", timestamp);
	
	//Get userID of both creator of post and user whose wall the post is going on
	getUserID(username, function(err, userID) {
		if (err) {
			console.log("error retrieving userID", err);
			callback(err);
		} else {
			getUserID(creatorname, function(err, creatorID) {
				if (err) {
					console.log("error getting creatorID", err);
					callback(err);
				} else {
					//Create post
					var post = {
						'userID': {S: userID},
						'creatorID': {S: creatorID},
						'postID': {S: postID},
						'content': {S: content},
						'timestamp': {N: timestamp}
					}
					
					var getUserDataParams = {
						TableName: "Accounts",
						Key: {"userID": {
							"S" : userID
						}}
					};
					//Get user data
					db.getItem(getUserDataParams, function(err, userIdData) {
						if (err) {
							console.log(err);
							reject(err);
						} else {
							//console.log("post username data: ", userIdData);
							//Update post data
							post.username = userIdData.Item.username;
							post.userFirstName = userIdData.Item.firstName;
							post.userLastName = userIdData.Item.lastName;
							var getCreatorDataParams = {
								TableName: "Accounts",
								Key: {"userID": {
									"S" : creatorID
								}}
							};
							//Get data of creator
							db.getItem(getCreatorDataParams, function(err, creatorIdData) {
								if (err) {
									console.log(err);
									reject(err);
								} else {
									//console.log("accounts creatorID data", creatorIdData);
									post.creatorUsername = creatorIdData.Item.username;
									post.creatorFirstName = creatorIdData.Item.firstName;
									post.userLastName = creatorIdData.Item.lastName;
									console.log(post);
									
									var paramsPosts1 = {
										TableName: "Posts1",
										Item: {
											'userID': {S: userID},
											'creatorID': {S: creatorID},
											'postID': {S: postID},
											'content': {S: content},
											'timestamp': {N: timestamp}
										}
									};
									//Put item into both post tables
									db.putItem(paramsPosts1, function(err, data) {
										if (err) {
											console.log("error creating post", err);
											callback(err)
										} else {
											console.log("successfully added post to post1");
											if (userID !== creatorID) {
												
												var paramsPosts2 = {
													TableName: "Posts2",
														Item: {
														'userID': {S: userID},
														'creatorID': {S: creatorID},
														'postID': {S: postID},
														'content': {S: content},
														'timestamp': {N: timestamp}
													}
												};
												db.putItem(paramsPosts2, function(err, data) {
													if (err) {
														console.log("error creating post", err);
														callback(err)
													} else {
														console.log("added post to posts2");
														callback(null, post);
													}
												})
											} else {
												callback(null, post);
											}
										}			
									});
								}
							})
						}
					})
					
					
					
					
				}
			});
		}
	});
}

//Log a message into the db
var logMessage = function(chatID, userID, message, timestamp, callback) {
	console.log("Logging message: ", message);
	var params = {
		TableName: "ChatRoomMessages",
		Item: {
			'chatID': {S: chatID},
			'userID': {S: userID},
			'message': {S: message},
			'timestamp': {N: timestamp}
		}
	}
	//Put item with all data into db
	db.putItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			console.log("Succesfully logged message");
			callback(null, data);
		}
	})
}

// adds a comment to the comments table
var addComment = function(postID, username, content, callback) {
	var commentID = uuidv4();
	var time = Date.now() + "";
	
	getUserID(username, function(err, userID) {
		if(err || !userID) {
			console.log("user trying to add comment is not in accounts table", err, data);
			callback(err, userID);
		} else {
			var params = {
				TableName: "Comments",
				Item: {
					'postID': {S: postID},
					'commentID': {S: commentID},
					'creatorID': {S: userID},
					'timestamp': {N: time},
					'content': {S: content},
				}
			}
			
			db.putItem(params, function(err, data) {
				if (err) {
					callback(err, null);
				} else {
					console.log("successfully added comment to database");
					callback(null, data);
				}
			})
		}
	})
	
}

// queries the Comments table to get all the comments for a particular postID
var getComments = function(postID, callback) {
	var params = {
		TableName: "Comments",
		KeyConditionExpression: 'postID = :postID',
		ExpressionAttributeValues: {
			':postID': {'S': postID}
		}
	}
	db.query(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			console.log("successfully queried for comments");
			console.log(data);
			var creatorIDs = data.Items.map(i => i.creatorID.S);
			console.log(creatorIDs);
			
			var currItemIndex = 0; //uhh this can't be the right way to do this .-.
			Promise.all(creatorIDs.map(function(value){
				return new Promise (function(resolve, reject){
					var usernameParams = {
						TableName: "Accounts",
						Key: {"userID": {
							"S" : value
						}}
					};
					db.getItem(usernameParams, function(err, usernameData) {
						if(err) {
							console.log(err);
							reject(err);
						} else {
							console.log("USERNAME DATA: ", usernameData);
							data.Items[currItemIndex].username = usernameData.Item.username;
							data.Items[currItemIndex].firstName = usernameData.Item.firstName;
							data.Items[currItemIndex].lastName = usernameData.Item.lastName;
							currItemIndex++;
							resolve(usernameData);
						}
					})
				})
			})).then(function(usernameData) {
				var result = data.Items.sort(function(a, b) {
					return b.timestamp.N - a.timestamp.N;
				})
				callback(null, data.Items);
			}).catch(function(err) {
				callback(err, null);
			})
		}
	})
}

//Given a chatID, return all messages
var getMessages = function(chatID, callback) {
    var param = {
		TableName: 'ChatRoomMessages',
		KeyConditionExpression: 'chatID = :chatID',
		ExpressionAttributeValues: {
			':chatID': {'S': chatID}
		}
	}
	db.query(param, function(err, data) {
		if (err) {
			console.log("QUERYING MESSAGES TABLE FAILED", err);
			callback(err, null);
		} else {
			callback(null, data.Items);
		}
	})
}

//Get all usernames given list of userIDs
var getListOfUsernames = function(userIDs, callback) {
	const usernames = [];
    promiseList = [];
    for (var i = 0; i < userIDs.length; i++) {
		var userID = userIDs[i];
		var params = {
			TableName: "Accounts",
			Key: {
				'userID': {
					"S": userID
				}
			},
		}
		const promise = db.getItem(params, function(err, data) {
			if(!data) {
				console.log("GET ACCOUNT ERROR:", err)
			} else {
				var username = data.Item.username.S;
				usernames.push(username);
			}
		}).promise();

        promiseList.push(promise);
    }
    Promise.all(promiseList).then(
        success => {
            callback(null, usernames);
        },
        error => {
            console.log("error with promise list");
        }
    )
}

//Given a chatID, return all users that are currently members of the chat
var getUsersInChat = function(chatID, callback) {
	var params = {
		TableName: 'ChatRoomMembers',
		KeyConditionExpression: 'chatID = :chatID',
		ExpressionAttributeValues: {
			':chatID': {'S': chatID}
		}
	}
	db.query(params, function(err, data) {
		if (err) {
			console.log("error getting members in chat room");
			callback(err, null);
		} else {
			console.log("users in chat: ", data);
			callback(null, data);
		}
	})
}

// gets all of the chats a user is in from the ChatRooms table
var getUserChats = function(userID, callback) {
	var param = {
		TableName: 'ChatRooms',
		KeyConditionExpression: 'userID = :userID',
		ExpressionAttributeValues: {
			':userID': {'S': userID}
		}
	}
	db.query(param, function(err, data) {
		if (err) {
			console.log("QUERYING CHATS TABLE FAILED", err);
			callback(err, null);
		} else {
			callback(null, data.Items);
		}
	})
}

//Given a user ID, get both all the chats the user is in and the members of each of those chats. Return as a map datatype
var getUserChatsWithMembers = function(userID, callback) {
	getUserChats(userID, function(err, chatRooms) { //Get all chats a user is in
		if (err) {
			console.log("error getting chat rooms");
		} else {
			const chatRoomUsers = new Map();
			const promiseList = [];

			if (chatRooms) { //If this list is not null, iterate through all and create a promise to get all the members in each chat room
				for (var i = 0; i < chatRooms.length; i++) {
					const chatRoom =  chatRooms[i].chatID.S;
					var params = {
						TableName: 'ChatRoomMembers',
						KeyConditionExpression: 'chatID = :chatID',
						ExpressionAttributeValues: {
							':chatID': {'S': chatRoom}
						}
					}
					const promise = db.query(params, function(err, data) {
						if (err) {
							console.log("error getting members in chat room");
						} else {
							if (!chatRoomUsers.get(chatRoom)) { 
								//Add all the retrieved users to the list of users for each chat room
								chatRoomUsers.set(chatRoom, []);
								for (var j = 0; j < data.Items.length; j++) {
									if (data.Items[j].userID.S === userID) { //Add "you" if the requester is also in the chat
										chatRoomUsers.get(chatRoom).push("you");
									} else {
										//var temp = data.Items[j].firstName.S + " " + data.Items[j].lastName.S;
										var temp = data.Items[j].userID.S;
										chatRoomUsers.get(chatRoom).push(temp);
									}
								}
							}
						}
					}).promise();
					promiseList.push(promise);
				}
				//Execute each of these promises
				Promise.all(promiseList).then(
					success => {
						for (let key of chatRoomUsers.keys()) {
							console.log("key: ", key, "value: ", chatRoomUsers.get(key));
						}
						callback(null, chatRoomUsers);
					},
					error => {
						console.log("Error retrieving all users for chats");
					}
				)
			} else {
				callback(true, false);
			}
			
		}
	})
}

//Given a chatID and a userID, check if the user is a member of the chat
var userInChat = function(chatID, userID, callback) {
	var params = {
		TableName: 'ChatRoomMembers',
		KeyConditionExpression: 'chatID = :chatID',
		ExpressionAttributeValues: {
			':chatID': {'S': chatID}
		}
	}
	//Return all members of the chat
	db.query(params, function(err, data) {
		if (err) {
			console.log("error getting members in chat room");
		} else {
			//Check if the given user is in the list of members
			for (let userInfo of data.Items) {
				var memberID = userInfo.userID.S;
				if (memberID === userID) {
					console.log("user is in chat");
					return callback(true);
				}
			}
			console.log("user not in chat");
			return callback(null);
		}
	})
}

//Create new chatRoom with new uuid as chatID, callback returns this chatID as data. userID is of the nofitication sender
var createChatRoom = function(chatInviter, callback) {
	//Create unique chat ID
	var chatID = uuidv4();
	var chatRoomsParams = {
		TableName: "ChatRooms",
		Item: {
			'userID': {S: chatInviter},
			'chatID': {S: chatID}
		}
	};
	console.log("Creating table 1");
	//Create the item in the table
	db.putItem(chatRoomsParams, function(err, data) {
		if (err) {
			callback(err);
		} else {
			var chatRoomMembersParams = {
				TableName: "ChatRoomMembers",
				Item: {
					'userID': {S: chatInviter},
					'chatID': {S: chatID}
				}
			}
			console.log("Creating table 2");
			db.putItem(chatRoomMembersParams, function(error, data) {
				if (error) {
					callback(error);
				} else {
					console.log("Finished creating new chat");
					callback(null, chatID);
				}
			})
		}
	})
}

//Once a chat invitation is accepted, add user to respective tables. userID is that of the recipient, chatID is stored in notification table
var addUserToChatRoom = function(chatInviter, chatInviteRecipient, chatID, callback) {
	console.log("Hello wolrd")
	getUserID(chatInviter, function(err, chatInviterID) {
		if (err) {
			console.log("failed to add user to chat")
		} else if (!chatInviterID) {
			console.log("Things went wrong big time")
		} else {
			getUserID(chatInviteRecipient, function(err, chatInviteRecipientID) {
				if (err) {
					console.log("failed to add user to chat")
				} else if (!chatInviteRecipientID) {
					console.log("Things went wrong. Should not have happened")
				} else {
					var paramsToQueryIfNotificationAlreadyExisted = {
						TableName: "Notification", 
						KeyConditionExpression: "recipientID =:r",
						FilterExpression: "notificationType = :n and senderID = :s",
						ExpressionAttributeValues : {
							":r": {
								"S": chatInviteRecipientID
							},
							":s": {
								"S": chatInviterID
							}, 
							":n": {
								"S": "chatRequest"
							}
						}
						
					}
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
							console.log("trying to add chat invites")
							var params = {
								TableName: "Notification", 
								Item : {
									"recipientID": {
										"S": chatInviteRecipientID
									}, 
									"senderID": {
										"S": chatInviterID
									}, 
									"timestamp": {
										"S": Math.floor(Date.now() / 1000) + ""
									}, 
									"notificationType": {
										"S": "chatRequest"
									}, 
									"chatID": {
										"S": chatID
									}
								}
							}
							console.log("MY PARAMS IS", params)
							db.putItem(params, function(err, data) {
								if (err) {
									console.log("Error sending chat invite");
									callback(err, null)
								} else {
									console.log("Successfully sent chat invite");
									
									callback(err, data)
								}
							});
									
							}
					})
				}
			}) 

		}
	})
}

// This function will accept chat invite by adding the user into the chatroom 
// and chat room members. It will also delete the chat invite item from the 
// notification table
var acceptChatInvite = function(recipientID, senderID, senderUsername, timestamp, chatID, callback) {

	var chatRoomsParams = {
        TableName: "ChatRooms",
        Item: {
            'userID': {S: recipientID},
            'chatID': {S: chatID}
        }
    };
	
	db.putItem(chatRoomsParams, function(err, data) {
		if (err) {
			console.log(err)
			callback(err, null);
		} else {
			
			var chatRoomMembersParams = {
				TableName: "ChatRoomMembers",
				Item: {
					'userID': {S: recipientID},
					'chatID': {S: chatID},
				}
			}
			db.putItem(chatRoomMembersParams, function(err, data) {
				if (err) {
					console.log(err)
					callback(err, null)
				} else {
					
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
					console.log("my params to delete is", paramsToDelete)
					db.deleteItem(paramsToDelete, function(err, data) {
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

//Given 2 users, see if there exists a chat where they are the only 2 members
var checkInDM = function(firstUserName, secondUserName, callback) {
	//Get userIDs for both
	getUserID(firstUserName, function(err, firstUserID) {
		if (err) {
			console.log("Error geting user ID");
		} else {
			getUserID(secondUserName, function(error, secondUserID) {
				//Get the chat rooms each user is in
				getUserChats(firstUserID, function(e, firstUserChats) {
					if (e) {
						console.log("Error getting chats for" , firstUserName);
					} else {
						getUserChats(secondUserID, function(er, secondUserChats) {
							if (er) {
								console.log("Error getting chats for", secondUserName);
							} else {
								//Check for any overlapping chatIDs by making the first user's chats into a set and iterating through
								//each of the second user's chats
								var firstUserChatsSet = new Set(firstUserChats.map(item => item.chatID.S));
								console.log("Set of first user chats", firstUserChatsSet);
								var overlapping = [];
								for (let i = 0; i < secondUserChats.length; i++) {
									var curr_chat = secondUserChats[i].chatID.S;
									if (firstUserChatsSet.has(curr_chat)) {
										overlapping.push(curr_chat);
									}
								}
								var noDMs = true;
								var chatDM;
								console.log("overlapping chats: ", overlapping);
								//check if the number of members in a overlapping set is 2, if so they are in a DM
								Promise.all(overlapping.map(function(chatRoom) {
									return new Promise(function(resolve, reject) {
										var params = {
											TableName: 'ChatRoomMembers',
											KeyConditionExpression: 'chatID = :chatID',
											ExpressionAttributeValues: {
												':chatID': {'S': chatRoom}
											}
										}

										db.query(params, function(erro, chatMembers) {
											if (erro) {
												reject(erro);
											} else {
												console.log("chat being checked", chatMembers);
												if (chatMembers.Items.length == 2) { //Set noDMs to false if this is true
													console.log("already has DM");
													noDMs = false;
													chatDM = chatRoom;
												}
												resolve(true);
											}
										})
									});
								})).then(function() {
									console.log("noDMs: ", noDMs);
									console.log("chatDM: ", chatDM);
									//Return the both the boolean noDMs and if noDMs is false, return the chatID of the DM room
									callback(noDMs, chatDM);
								});
							}
						})
					}
				})
			})
		}
	})
}

var addLike = function(postID, username, callback) {
	//get userID from username
	getUserID(username, function(err, userid) {
		if(err) {
			console.log(err);
		} else {
			console.log("id of liker", userid);
			var params = {
				TableName: "Likes",
				Item: {
					'postID': {S: postID},
					'userID': {S: userid}
				}
			};
			db.putItem(params, function(error, data) {
				if(error) {
					console.log("failed to add like");
					callback(error, null);
				} else {
					console.log(data);
					callback(null, data);
				}
			})
		}
	})
}

var getLikes = function(postID, username, callback) {
	getUserID(username, function(err, userid) {
		if(err) {
			console.log(err);
		} else {
			console.log("id", userid);
			var params = {
				TableName: 'Likes',
				KeyConditionExpression: 'postID = :postID',
				ExpressionAttributeValues: {
					':postID' : {'S': postID}
				}
			};
			db.query(params, function(error, data) {
				if(error) {
					callback(error, null, null);
				} else {
					// check if user has already liked
					const hasLiked = data.Items.filter(i => i.userID.S === userid);
					//console.log("HAS LIKED DATA", hasLiked);
					if (hasLiked.length == 0) {
						callback(null, data.Items.length, false);
					} else {
						callback(null, data.Items.length, true);
					}
				}
			})
		}
	})
}

var removeLike = function(postID, username, callback) {
	getUserID(username, function(err, userid) {
		if(err) {
			callback(err, null);
		} else {
			var params = {
				TableName: "Likes",
				Key: {
					'postID' : {
						'S': postID
					},
					'userID' : {
						'S': userid
					}
				}
			};
			
			db.deleteItem(params, function(err, data) {
				if (err) {
					callback(err, null);
				} else {
					console.log(data);
					callback(err, data);
				}
			})
		}
	})
}

var postArticleLike = function(headline, username, callback){

	getUserID(username, function(err, userID) {
		if(err || !userID) {
			console.log("user trying to add comment is not in accounts table", err, data);
			callback(err, userID);
		} else {
			var likedarticleparam = {
				TableName: "NewsLikes",
				Item: {
					'headline': {S: headline},
					'userID': {S: userID}
				}
			};
		
			db.putItem(likedarticleparam, function(err, data){
				if(err){
					console.log(err);
					callback(err, null)
				}
				else{
					console.log(data);
					callback(null, data)
				}
			})
		}
	})
	

}


var removeArticleLike = function(headline, username, callback) {
	getUserID(username, function(err, userid) {
		if(err) {
			callback(err, null);
		} else {
			var params = {
				TableName: "NewsLikes",
				Key: {
					'headline' : {
						'S': headline
					},
					'userID' : {
						'S': userid
					}
				}
			};
			
			db.deleteItem(params, function(err, data) {
				if (err) {
					callback(err, null);
				} else {
					console.log(data);
					callback(err, data);
				}
			})
		}
	})
}


var postCategoryLike = function(category, username, callback){

	getUserID(username, function(err, userID) {
		if(err || !userID) {
			console.log("user trying to set category interest is not in accounts table", err, data);
			callback(err, userID);
		} else {
			var categoryparam = {
				TableName: "NewsInterests",
				Item: {
					'userID': {S: userID},
					'category': {S: category}
				}
			};
		
			db.putItem(categoryparam, function(err, data){
				if(err){
					console.log(err);
					callback(err, null)
				}
				else{
					console.log(data);
					callback(null, data)
				}
			})
		}
	})
	

}





var getLikedCategories = function(username, callback){

	getUserID(username, function(err, userID) {
		if(err || !userID) {
			console.log("user trying to set category interest is not in accounts table", err, data);
			callback(err, userID);
		} else {
			var queryparam = {
				TableName: 'NewsInterests',
				KeyConditionExpression: 'userID = :userID',
				ExpressionAttributeValues: {
					':userID': {'S': userID}
				}
			}
			
			db.query(queryparam, function(err, data){
				if(err){
					console.log(err);
					callback(err, null)
				}
				else{
					console.log(data);
					callback(null, data)
				}
			})
		}
	})
	

}


var getRecommendedArticles = function(username, callback){

	getUserID(username, function(err, userID) {
		if(err || !userID) {
			console.log("no articles for the given user were in the table", err, data);
			callback(err, userID);
		} else {
			var queryparam = {
				TableName: 'NewsWeights',
				KeyConditionExpression: 'userID = :userID',
				ExpressionAttributeValues: {
					':userID': {'S': userID}
				}
			}
			
			db.query(queryparam, function(err, data){
				if(err){
					console.log(err);
					callback(err, null)
				}
				else{
					console.log(data);
					callback(null, data)
				}
			})
		}
	})
}

// This is responsible for delete the old prefixes and update the new prefixes in the Prefix table
var deleteUserIDFromPrefixTable = function(userID, oldUsername, newUsername, callback) {
	
	function deleteAnIDFromAListOfAPrefix (myPrefix) {
		var prefixParams = {
			TableName: "Prefix",
			// getItem with key as a prefix of the string. 
			Key: {
				'prefix': {S: myPrefix}
			},
			UpdateExpression: "DELETE userIDs :u",
			ExpressionAttributeValues: {
				":u": {
					"SS": [userID]
				}
			},
			ReturnValues: "ALL_NEW"
		}
		console.log(prefixParams)
		return db.updateItem(prefixParams).promise()
	}

	let listOfPrefixesOfOldUserName = []
	for (let i = 1; i <= oldUsername.length; i++) {
		var currentPrefix = oldUsername.substring(0, i)
		listOfPrefixesOfOldUserName.push(currentPrefix)
	}

	let listOfPrefixOfNewUserName = [] 
	for (let i = 1; i <= newUsername.length; i++) {
		var currentPrefix = newUsername.substring(0, i)
		listOfPrefixOfNewUserName.push(currentPrefix)
	}


	console.log(listOfPrefixesOfOldUserName)
	var myArrayOfPromises = listOfPrefixesOfOldUserName.map(deleteAnIDFromAListOfAPrefix)
	Promise.all(myArrayOfPromises).then((normalArrays) => {

		
		function addNewUpdateIntoPrefixTable(myPrefix) {
			var myprefixParams = {
				TableName: "Prefix",
				// getItem with key as a prefix of the string. 
				Key: {
					'prefix': {S: myPrefix}
				},
				UpdateExpression: "ADD userIDs :u",
				ExpressionAttributeValues: {
					":u": {
						"SS": [userID]
					}
				},
				ReturnValues: "ALL_NEW"
			}
			console.log("reached", myprefixParams) 
			return db.updateItem(myprefixParams).promise() 
		}
		

		var myArrayOfPromises1 = listOfPrefixOfNewUserName.map(addNewUpdateIntoPrefixTable)
		Promise.all(myArrayOfPromises1).then((aNormalArray) => {
			callback(null, data)
		}).catch(function(err) {
			callback(err, data)
		})

	}).catch(function(err) {
		console.log(err)
		callback(err, data)
	})		
}

// This simply deletes the corresponding chat invite from the Notification table. 
var rejectChatInvite = function(recipientID, senderID, senderUsername, timestamp, chatID, callback) {

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
	console.log("my params to delete is", paramsToDelete)
	db.deleteItem(paramsToDelete, function(err, data) {
		if (err) {
			console.log(err)
			callback(err, null)
		} else {
			callback(err, null)
		}
	})
}




var database = {
	addUser: addUser,
	getUserInfo: getUserInfo, 
	getPosts: getPosts,
	getUserInfoFromID: getUserInfoFromID,
	getSearchResult: getSearchResult,
	getSuggestions: getSuggestions,
	checkLogin: checkLogin,
	addPost: addPost,
	updateAccount: updateAccount,
	getUserID: getUserID, //lmk if this is bad security/should only be called in this file
	logMessage: logMessage,
	addComment: addComment,
	getComments: getComments,
	getMessages: getMessages,
	getListOfUsernames: getListOfUsernames,
	getUserChatsWithMembers: getUserChatsWithMembers,
	userInChat: userInChat,
	addLike: addLike,
	getLikes: getLikes,
	removeLike: removeLike,
	postArticleLike: postArticleLike,
	addUserToChatRoom: addUserToChatRoom,
	postCategoryLike: postCategoryLike,
	getMultiplePosts: getMultiplePosts,
	acceptChatInvite: acceptChatInvite,
	getLikedCategories : getLikedCategories,
	createChatRoom: createChatRoom,
	getRecommendedArticles: getRecommendedArticles,
	removeArticleLike: removeArticleLike,
	checkInDM: checkInDM,
	deleteUserIDFromPrefixTable: deleteUserIDFromPrefixTable,
	rejectChatInvite: rejectChatInvite
}
module.exports = database;
