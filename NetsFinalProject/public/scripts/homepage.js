
var socket = io(); 

$.getJSON('/getUserInfo', function(data) {
    socket.emit('login', {
        user: data.Item.username.S
    });
});


$(document).ready(function() {
    $("#like").click(function() {
        console.log("here")
    })


    
    $("#search").keyup(function() {
        var searchName =  $("#search").val();
        
        
        if (searchName) {
            $.post("/getSearchResult",
            {
                searchName: searchName
            }, function(data) {
                var myData = JSON.parse(data)
                if (!myData.status) {
                    console.log("Database did us wrong")
                } else {
                    
                    var results = myData.list
                    console.log(results)
                    $(".search-input").addClass("active")
                    // if results empty, show onlly whatever the user is typing


                    if (results != null) {
                        
                        console.log(results)
                        result = results.join("")
                        $(".autocom-box").html(result)
                    } else {
                        $(".autocom-box").html('<li>' + searchName + '</li>')
                    }
                    // else, show the list
                }
            })
        } else {
            $(".search-input").removeClass("active")
        }
        
    })

    $(".notification-button").click(function() {
        const ele = $(".notification-popup");
        if (ele.hasClass("active")) {
          console.log("remove active");
          ele.removeClass("active");
        } else {
          console.log("add active");
          ele.addClass("active");

        }
    })

    document.addEventListener(
        "click",
        function (event) {
          // If user either clicks X button OR clicks outside the modal window, then close modal by calling closeModal()
          if (
            event.target.closest(".notification-button") == null &&
            event.target.closest(".notification-popup") == null
          ) {
            $(".notification-popup").removeClass("active");
          }
        },
        false
      );

})
	
