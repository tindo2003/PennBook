var postIDs = new Set; // maybe just keep a set of ids. use ids as id names in div
var minPostIndex = 0;
var maxPostIndex = 20;
var currentMaxScrollHeight = 0;
var outerDiv = document.createElement("div");
var user;
var numTotalPosts;
var numFriends;
var interests = new Set;

// converts a timestamp to date format
function timeToDate(timestamp) {
	var time = new Date(0);
    time.setUTCSeconds(timestamp / 1000);
    var date;
    var currTime = new Date(0);
    currTime.setUTCSeconds(Date.now() / 1000);
    if (time.getDate() == currTime.getDate() && time.getFullYear() == currTime.getFullYear()) {
        var minute = (Math.floor(time.getMinutes() / 10) == 0) ? "0" + time.getMinutes() : time.getMinutes();
        var hours;
        var ampm;
        if (time.getHours() == 0) {
            hours = 12;
            ampm = "AM";
        } else if (time.getHours() >= 12) {
            hours = (time.getHours() == 12) ? time.getHours() : time.getHours() - 12;
            ampm = "PM";
        } else {
            hours = time.getHours();
            ampm = "AM";
        }
        date = "Today at " + hours + ":" + minute + " " + ampm;
    } else {
        date = time.getMonth() + "/" + time.getDate() + "/" + time.getFullYear();
    }
    return date;
}

// creates a div to display a post
function createPostDiv(postData, isAppend) {
	var post = document.createElement("div");
	
	const button = document.createElement("BUTTON");
	button.innerText = "comments";
	button.className = "form_button commentButton";
	
	var form = document.createElement("form");
	
	var textbox = document.createElement("input");
	textbox.setAttribute("type", "text");
	textbox.setAttribute("placeholder", "# Make a comment...");
	textbox.id = "text" + postData.postID.S;
	textbox.className = "add-comment-textbox";
	var submit = document.createElement("input");
	submit.setAttribute("type", "submit");
	submit.setAttribute("value", "submit comment");
	submit.className = "form_button commentButton";
	submit.id = postData.postID.S;
	submit.setAttribute("name", "comment-submit-button");
	$(form).append(textbox, submit);
	
	//document.body.appendChild(button);
	const likeButton = document.createElement("BUTTON");
	likeButton.innerText="like";
	likeButton.className = "form_button likeButton";
	likeButton.style['margin-left'] = '20px';
	
	const likeButtonText = document.createElement("p");
	// if id is 'on', then it has already been liked. also have to make a remove likes route
	
	likeButton.id = "like-"+postData.postID.S;
	
	var inter_bar = document.createElement("div");
	inter_bar.className = "interaction_bar";
	$(inter_bar).append(form, button, likeButton, likeButtonText);
	    
    // convert timestamp to a time date
    var date = timeToDate(postData.timestamp.N);
	
	var postHeader = document.createElement("div");
	postHeader.innerHTML = postData.creatorUsername.S + " -> " + postData.username.S + " : " + date;
	postHeader.style['font-weight'] = 'bold';
	postHeader.style['margin-bottom'] = '10px';
	
	var content = document.createElement("div");
	content.innerHTML = postData.content.S;
	
	//console.log("current post:", postData);
	//post.id = postData.postID.S;
	post.className = "post";
	post.append(postHeader, content, inter_bar);
	
	if (isAppend) {
		//console.log("append post", isAppend);
		outerDiv.append(post);
	} else {
		console.log("prepend post", isAppend);
		outerDiv.prepend(post);
	}
	
	$('#posts').append(outerDiv);
	
	//console.log(postData.postID.S);
	postIDs.add(postData.postID.S);
	
	// have to call getLikes here to show how many likes and to check if user has liked already or not
	$.getJSON("/getLikes", {postID: postData.postID.S}, function(res) {
		//console.log(res);
		if(res.alreadyLiked) {
			likeButton.classList.add("on");
			//console.log("initially liked");
		}
		$(likeButtonText).html(res.numLikes);
	})
	
	// add event listener to toggle like/unliking a post
	likeButton.onclick = function(){
		if (likeButton.classList.contains("on")) {
			console.log("remove like entered");
			likeButton.classList.remove("on");
			$.post("/removeLike", {postID: postData.postID.S}, function(result) {
				console.log(result);
				$.getJSON("/getLikes", {postID: postData.postID.S}, function(res) {
					console.log(res);
					$(likeButtonText).html(res.numLikes);
					//$(inter_bar).append(res.numLikes);
				})
			})
		} else {
			$.post("/addLike", {postID: postData.postID.S}, function(result) {
				console.log(result);
				// make the button clicked (liked)
				likeButton.classList.add("on")
				$.getJSON("/getLikes", {postID: postData.postID.S}, function(res) {
					console.log(res);
					$(likeButtonText).html(res.numLikes);
					//$(inter_bar).append(res.numLikes);
				})
			})
		}				
	};
	
	// toggle comment opening
	var commentsOpened = false;
	button.onclick = function(){
		console.log(commentsOpened);
		const id = postData.postID.S;
		if(commentsOpened) {
			$(post).children().last().remove();
		} else {
			$.getJSON('/getComments', {postID: id}, function(comments) {
			var commentContainer = document.createElement("div");
			commentContainer.className = "comment-container";
			commentContainer.id = "comment-container-"+id;
			console.log(commentContainer);
			
			if (comments.length == 0) {
				// show empty comment section
				console.log("no comments");
				commentContainer.innerHTML = "no comments";
			} else {
				// expand under post to show comment section. then change text to hide comment section						
				console.log("in else", comments);
				function createCommentDiv(commentData) {
					var comment = document.createElement("div");
					comment.className = "indiv-comment-container";
					
					var commentHeader = document.createElement("div");
					commentHeader.className = "comment-header";
					commentHeader.style['font-weight'] = 'bold';
					
					var date = timeToDate(postData.timestamp.N);
					//console.log('commentdate', date);
					commentHeader.innerHTML = "@" + commentData.username.S + " " + commentData.firstName.S + " " + commentData.lastName.S + " " + date;
					
					var textDiv = document.createElement("div");
					textDiv.innerText = commentData.content.S;
					textDiv.className = "comment-text";
					comment.append(commentHeader, textDiv);
					commentContainer.append(comment);
				}
				comments.forEach(createCommentDiv);
			}
			post.append(commentContainer);
		})
		}
		commentsOpened = !commentsOpened;
	};
}

$(document).ready(function() {
	/*
	$("#search").keyup(function() {
		var searchName =  $("#search").val();
		
		if (searchName == "") {
			$("#display").html("");
		} else {
			console.log("i am not empty!")
			$.post("/getSearchResult", 
			{
				searchName: searchName
			}, function(data, status) {
				var myData = JSON.parse(data)
				console.log(myData)
				$("#display").html(myData.list).show();
			})
		}
		
	})
	*/
				
	$('#message-button').click(function() {
		$.getJSON('/getUserInfo', function(data) {
			$.getJSON('/getSelfInfo', function(selfData) {
				var recipient = data.Item.username.S;
				var username= selfData.Item.username.S;
				console.log("Intended recip: ", recipient);
				$.post('/createChatRoom', {
						sender: username,
						recipient: recipient},
					function(chatData) {
						console.log("Send post for adding user");
						if (!chatData.success) {
							alert("Error creating chat!");
						} else {
							console.log("Created new chat");
							window.location.href = "/chatRoom?chatID=" + chatData.chatID;
						}
					}
				);
			})
		})
	})

	// get that user's data
	$.getJSON('/getUserInfo', function(data) {
		console.log("USER INFO", data);
		$('#accountData').html('Account data: <br> email:' + data.Item.email.S + '<br>' 
				+ 'username: ' + data.Item.username.S);
		$('#name').html(data.Item.firstName.S + " " + data.Item.lastName.S);
		$('#username').html("@" + data.Item.username.S);
		$('#username').css({"font-style": "italic"});
		user = data.Item.username.S;
		console.log('username', user);
		
		// get number of friends
		$.getJSON('/getNumFriends', function(data) {
			console.log("get num friends", data);
			$('#num_friends').html(data.numFriends + " Friends");
			$('#num_friends').css({"font-style": "italic"});
		})
		
		$.getJSON('/getInterests', function(data) {
			console.log("get interests", data.interests.Items);
			var interests = data.interests.Items.slice(0, 3).map(e => e.category.S);
			var interest_string = interests.join();
			if (data.interests.Items.length > 3) {
				interest_string += "...";
			}
			console.log(interest_string);
			
			$('#interests').html("Interests: " + interest_string);
			$('#interests').css({"font-style": "italic"});
		})
		
		loadNextPosts();
		updatePosts();
	})
	
	// Adding a post
	$('#create-post-form').submit(function(event) {
		event.preventDefault();
		if($('#postContent').val() != '') {
			console.log("create post");
			$.post('/addPost', {
				username: user,
				content: $('#postContent').val()
			}, function(addResult) {
				console.log("addResult", addResult);
				if(addResult.success) {
					// display the added post immediately
					createPostDiv(addResult.data, false);
					console.log('success');
				}
				$('#postContent').val("");
				console.log("add post result", addResult);
			})
		}
	})
	
	// add comment
	$('#posts').on('click', "input[name='comment-submit-button']", function(event) {
		event.preventDefault();
		var id = $(this).attr('id');
		console.log(id);
		var commentDivID = "comment-container-"+id;
		var textid = "text" + $(this).attr('id');
		console.log(textid);
		var c = $('#' + textid).val();
		console.log(c);
		if(c == '') {
			//alert("empty thing"); //or make button dark so cant be clicked
		} else {
			$.post('/addComment', {
				postID: $(this).attr('id'),
				content: c
			}, function(result) {
				
				console.log(result);
				$('#' + textid).val("");
				var commID = document.getElementById(commentDivID);
				// display comment
				if(commID) {
					if (commID.children.length > 0) {
						console.log("not empty");
					} else {
						console.log("empty");
						$('#' + commentDivID).empty();
					}
					console.log("comment section opened");
					
					// create a new comment to display
					var comment = document.createElement("div");
					comment.className = "indiv-comment-container";
					
					var commentHeader = document.createElement("div");
					commentHeader.className = "comment-header";
					commentHeader.style['font-weight'] = 'bold';
					
					var date = timeToDate(result.newComment.timestamp.N);
					commentHeader.innerHTML = "@" + result.newComment.username.S + " " + result.newComment.firstName.S + " " + result.newComment.lastName.S + " " + date;
					
					var textDiv = document.createElement("div");
					textDiv.innerText = result.newComment.content.S;
					textDiv.className = "comment-text";
					comment.append(commentHeader, textDiv);
					
					$('#' + commentDivID).prepend(comment);
				} else {
					console.log("comment section closed");
				}
			})
		}
	})
	
})

// asynchronously check for friend notifications
var refreshPage = function() {
    $.getJSON('/getNotifications', 
    {}, 
    function(data) {
        // console.log("HELLO WORLD", data)
        
        if (data.success) {
            var myResult = ""
            $(".notification-popup").empty()
            
            var $newdiv1 = $( "<div class='notification-popup-header'><h6>Notification</h6> </div>" )
            $(".notification-popup").append($newdiv1)
            
        
            for (var i = 0; i < data.data.length; i++) {
                var currentDict = data.data[i]


                if (currentDict.notifType === 'friendRequest') {
                    
                    var s = currentDict.timestamp
                    var d = new Date(0); 
                    d.setUTCSeconds(s);

                    var myDiv = document.createElement('div');
                    myDiv.className = 'notification-item'
                    var ul = document.createElement("ul");
                    var li = document.createElement("li");  
                    var h6 = document.createElement('h6');
                    h6.innerHTML = "You have received a friend request from <a href=/user/" + currentDict.senderUsername 
                    + ">" + currentDict.senderUsername +  "</a></h7> on " + d;
                   
                    var input = document.createElement("input");
                    input.type = "hidden"
                    input.name = "hiddenField"
                    input.id = currentDict.senderID + ";" + currentDict.recipientID + ";" + currentDict.senderUsername + ";" + s
                    var input1 = document.createElement("input");
                    input1.name = "wantedInfo"
                    input1.type = "button"
                    input1.value = "Add friend"
                    input1.addEventListener('click', acceptFriendRequestAction)
                    li.appendChild(h6)
                    li.appendChild(input)
                    li.appendChild(input1)
                    ul.appendChild(li);
                    myDiv.appendChild(ul)
                    $(".notification-popup").append(myDiv)
                } else if (currentDict.notifType === 'chatRequest'){
                    var s = currentDict.timestamp
                    var d = new Date(0);
                    d.setUTCSeconds(s);
        

                    var myDiv = document.createElement('div');
                    myDiv.className = 'notification-item'
                    var ul = document.createElement("ul");
                    var li = document.createElement("li"); 
                    var h6 = document.createElement('h6');
                    h6.innerHTML = "You have received a chat request from <a href=/user/" + currentDict.senderUsername
                    + ">" + currentDict.senderUsername +  "</a></h7> on " + d;
                    
                    var input = document.createElement("input");
                    input.type = "hidden"
                    input.name = "hiddenField"
                    input.id = currentDict.senderID + ";" + currentDict.recipientID + ";" + currentDict.senderUsername + ";" + s + ";" + currentDict.chatID
                    
					
					var input1 = document.createElement("input");
                    input1.name = "chatInvite"
                    input1.type = "button"
                    input1.value = "Accept"
                    input1.addEventListener('click', acceptChatInviteAction)

					var input2 = document.createElement("input");
					input2.name = "chatReject"
					input2.type = "button"
                    input2.value = "Reject"
					input2.addEventListener('click', rejectChatInviteAction)


                    li.appendChild(h6)
                    li.appendChild(input)
                    li.appendChild(input1)
					li.appendChild(input2)
                    ul.appendChild(li);
                    myDiv.appendChild(ul)
                    $(".notification-popup").append(myDiv)
                }
            }
        }
       
    })
    setTimeout(refreshPage, 1000); 
}



$(document).ready(function() {
	$('#addFriend').click(function() {
		$.post("/addFriend", {

		}, function(data) {
			const content = JSON.parse(data)

			$("#myModal .modal-body").text(content.message);
			$('#myModal').modal('show'); 
		});
	})
})



$(document).ready(function() {
	setTimeout(refreshPage, 1000); 
	//setTimeout(updatePosts, 10000);
})




function rejectChatInviteAction() {
	
	$(document).ready(function() {
		$('.notification-popup').on('click', "input[name='chatReject']", function() {
			console.log("ODMSFDSOFSF")


            var temp = $(this).parent().children('input[name="hiddenField"]').attr('id')
            temp = temp.split(";")
            var senderID = temp[0]
            var recipientID = temp[1]
            var senderUserName = temp[2]
            var timestamp = temp[3]
            var chatID = temp[4]
            
            $.post('/rejectChatInvite',
            {
                "senderID": senderID,
                "recipientID": recipientID,
                "senderUserName": senderUserName,
                "timestamp": timestamp,
                "chatID": chatID
            },
            function(data) {
                data = JSON.parse(data)
                if (data) {
                    console.log(data.message)
                } else {
                    console.log(data.message)
                }
            })
		})
	})
}




function acceptFriendRequestAction() {

	$(document).ready(function() {
		

		 // get username and recpient username and query it using
		 $('.notification-popup').on('click', "input[name='wantedInfo']", function(){
		
			var temp = $(this).parent().children('input[name="hiddenField"]').attr('id')
			temp = temp.split(";")
			var senderID = temp[0]
			var recipientID = temp[1]
			var senderUserName = temp[2]
			var timestamp = temp[3]
			
			$.post('/acceptFriendRequest', 
			{
				"senderID": senderID,
				"recipientID": recipientID,
				"senderUserName": senderUserName,
				"timestamp": timestamp
			}, 
			function(data) {
				data = JSON.parse(data)
				if (data.success) {
					
					$("#myModal .modal-body").text(data.message);
					$('#myModal').modal('show'); 
				} else {
					
					$("#myModal .modal-body").text(data.message);
					$('#myModal').modal('show'); 
				}
			})
		})
	})
}


function acceptChatInviteAction() {
    console.log("accept chat invite")
    $(document).ready(function() {
        $('.notification-popup').on('click', "input[name='chatInvite']", function() {

            var temp = $(this).parent().children('input[name="hiddenField"]').attr('id')
            temp = temp.split(";")
            var senderID = temp[0]
            var recipientID = temp[1]
            var senderUserName = temp[2]
            var timestamp = temp[3]
            var chatID = temp[4]
            
  
            $.post('/acceptChatInvite',
            {
                "senderID": senderID,
                "recipientID": recipientID,
                "senderUserName": senderUserName,
                "timestamp": timestamp,
                "chatID": chatID
            },
            function(data) {
                data = JSON.parse(data)
                if (data) {
                    console.log(data.message)
                } else {
                    console.log(data.message)
                }
            })
        })
    })
 }
 

// TO BE DELETED
function getFriendVisualizerPlease() {
	$(document).ready(function() {
		$.getJSON('/friendvisualization', function(json) {
			// WHAT TO DO NOW???
			var w = ("#visualizer").offsetWidth - 50; 
			var h = ("#visualizer").offsetHeight - 50;
			console.log(json)
			var ht = new $jit.Hypertree({

				//id of the visualization container
				injectInto: 'infovis',
				//canvas width and height
				width: w,
				height: h,
				//Change node and edge styles such as
				//color, width and dimensions.
				Node: {
					//overridable: true,
					'transform': false,
					color: "#f00"
				},
			
				Edge: {
					//overridable: true,
					color: "#088"
				},
				//calculate nodes offset
				offset: 0.2,
				//Change the animation transition type
				transition: $jit.Trans.Back.easeOut,
				//animation duration (in milliseconds)
				duration:1000,

				onPlaceLabel: function(domElement, node){
					var width = domElement.offsetWidth;
					var intX = parseInt(domElement.style.left);
					intX -= width / 2;
					domElement.style.left = intX + 'px';
				},

				onComplete: function(){
				}
			});
			ht.loadJSON(json);
			//compute positions and plot.
			ht.refresh();
			//end
			ht.controller.onBeforeCompute(ht.graph.getNode(ht.root));
			ht.controller.onAfterCompute();
			ht.controller.onComplete();
		});
	})
}

function validate(term) {
	var searchString = term.value;
		if (searchString.length > 0 && searchString.match(/^[A-Za-z ]+$/)) {
			$('#search-term').text(searchString);
			return true;
		} else {
		alert("A search term must be purely alphabetic and contain no whitespace");
		var event = window.event;
		event.stopPropagation();
		event.preventDefault();
	
		document.searchForm.keyword.focus();
		return false;
	}
}

function updatePosts() {
	console.log("called updatePosts", user);
	// checkforupdates route compares the most recent post id displayed with the most recent post id with the database
	// if they are different, then sends over top posts for updating
	$.getJSON('/getPosts', {"updatePostCall": true, "username": user}, function(result) {
		console.log("GET POST RESULT:", result);
		if (result.numPosts == 0 || postIDs.has(result.topID.S)) {
			console.log("no new posts (num total posts)", numTotalPosts, postIDs.size);
		} else {
			console.log("new posts");
			var notFinishedUpdating = true;
			const numNewPosts = result.numPosts - numTotalPosts;
			console.log(numNewPosts);
			
			//while (notFinishedUpdating) {
				$.getJSON('/getPosts', {"minPostIndex": 0, "maxPostIndex": numNewPosts, "username": user}, function(result2) {
					console.log(result2);
					console.log(postIDs);
					for(var i=0; i < result2.data.length; i++) {
						if(postIDs.has(result2.data[i].postID.S)) {
							console.log("entered");
							notFinishedUpdating = false;
							break;
						} else {
							console.log(result2.data[i].postID);
							createPostDiv(result2.data[i], false);
							minPostIndex++;
							maxPostIndex++;
						}
					}
				})
			//}
		}
	})
	setTimeout(updatePosts, 10000);
}

// 'infinite' post scrolling
var timer;
$(window).scroll(function() {
    clearTimeout(timer);
	const scrollHeight = $(document).height();
	const scrollPos = Math.floor($(window).height() + $(window).scrollTop());
	const isBottom = scrollHeight - 100 < scrollPos;

    timer = setTimeout(function() {
    	if (isBottom && currentMaxScrollHeight < scrollHeight) {
			loadNextPosts();
			currentScrollHeight = scrollHeight;
		}
    }, 250);
});


function loadNextPosts() {
	console.log("load next post indices", minPostIndex, maxPostIndex, user);
	if (minPostIndex != maxPostIndex) { // not at the end of the posts
		$.getJSON('/getPosts', {"username": user, "minPostIndex": minPostIndex, "maxPostIndex": maxPostIndex}, function(result) {
			if (result) {
				for(var i=0; i < result.data.length; i++) {
					createPostDiv(result.data[i], true);
					minPostIndex++;
				}
				console.log("Post ids:", postIDs);
				if (result.isLastPost) {
					maxPostIndex = minPostIndex;
					console.log("end of posts")
				} else {
					maxPostIndex = minPostIndex + 20;
				}
				numTotalPosts = result.numPosts;
			} else { // no posts - end of the posts
				$('#posts').html('User has no posts. You can make the first post on this wall!')
				maxPostIndex = minPostIndex;
			}
		})
	}
}


