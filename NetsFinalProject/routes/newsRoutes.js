/**
 * 
 */
const stemmer = require("stemmer");
const { spawn } = require("child_process");


const AWS = require("aws-sdk");
const { postArticleLike } = require("../models/database");
var db = require('../models/database.js');


AWS.config.update({region:'us-east-1'});


var addLike = async function (request, response){
    var docClient = new AWS.DynamoDB.DocumentClient();
	

}

//route for getting news article results after search input
var searchNews =  async function(request, response) {
    
	var docClient = new AWS.DynamoDB.DocumentClient();
    //split the sequence of keywords and parse them
    keywords = request.query.keyword.split(" ")

    var keycopies = keywords
    console.log(keywords);
    keywords = keywords.filter(function(val, index) {
        return keywords.indexOf(val) == index;
    })

    for (let i = 0; i < keywords.length; i++) {
        curr = keywords[i]
        curr = curr.toLowerCase()
        curr = stemmer(curr)
        keywords[i] = curr
    }

    newset = new Set()
    results = []
    promisearray = []
    console.log("trip1");

    //assemble our list of promises of queries for retrieving all relevant keywords
    for (let i = 0; i < keywords.length; i++) {

        if (newset.size == 15){
            break
        }

        console.log(i);

        
        currkeyword = keywords[i]

        console.log(currkeyword);

        var params = {
            KeyConditionExpression: "#keyword = :keyword",
            TableName: 'NewsSearch',
            ExpressionAttributeNames: {
                "#keyword": "keyword"
            },
            ExpressionAttributeValues: {
                ":keyword": currkeyword
            },
        
        
        };

        

        let temp = []
        
        currpromise = docClient.query(params, function(err, data) {
        if (err) {
            console.log("wowza")
            console.log("Error", err);
        } else {
            temp = data.Items
            console.log(temp)
            for (var i = 0; i < temp.length; i++){
                if (temp[i] != undefined){
                newset.add(temp[i]["headline"])
                if(newset.size == 15){
                    break
                }
            
                }
            }
        }
        }).promise();
        
        promisearray.push(currpromise)
    }

    console.log("trip2");
    console.log(promisearray)


    //use an await to ensure that all promises are kept
    //console.log(promisearray)
    finalresults = await Promise.all(promisearray)

    console.log(finalresults);

    console.log("trip3");


    counter = 0
    //take the first 15 elements in the set or fewer if the seize of the set < 15 and add them to our results
    for (const curritem of newset) {
        if (counter == 15){
            break;
        }
        else{
            results.push(curritem)
        }
        counter = counter +1
    
    }

    console.log(results)


    otherpromisearray = []

    console.log("trip4");



 
    tracker = new Set()
    actualfinalresults = new Set()

    for (let i = 0; i < results.length; i++) {
    //loop through the array containing the ted talk ids of our queried ted talks 
    //query for data on the ted talk corresponding to each ted talk id

    var docClient = new AWS.DynamoDB.DocumentClient();
    let parsedword = results[i];
    
    var params = {
        KeyConditionExpression: "headline = :headline",
        TableName: 'News',
        ExpressionAttributeValues: {
            ":headline": parsedword
        },
    
    };
    
   


    //initialize a hashmap to prevent duplicate links from being generated

    currpromise = docClient.query(params, function(err, data) {
    if (err) {
        console.log("Error", err);
    } else {
        
        //query for ted talks that correspond to the given talk ids
        result = data.Items[0]
        if(result){
            if(tracker.has(result.headline) == false){
                actualfinalresults.add(result)
                tracker.add(result.headline)

            }
             
        }
        	
        
    }


    }).promise();
    
    otherpromisearray.push(currpromise)
        
    }

    console.log(actualfinalresults)

    newfinalresults = await Promise.all(otherpromisearray)
    
    //return final array of results
    var outputarray = Array.from(actualfinalresults)

    var finalarray = [...new Set(outputarray)];


    request.session.visitinguser = request.session.username

    response.render("newssearch.ejs", {results: finalarray, searchterms: keywords})

 
}; 

var setInterestSession = function(req, res) {
    req.session.interest = req.body.interest;
    res.send({success: true});
}



//route for adding a new user interest to the DynamoDB table
var createInterest = async function(request, response) {

    category = request.body.category
    currentuser = request.session.username
    console.log("category: ", category)
    console.log("username: ", currentuser)


    db.postCategoryLike(category, currentuser, function(err, data){
        if(err){
            console.log(err)
        }
        else{
            console.log(data)
            response.send({success: true})
        }
    })
}

//route for adding a new liked article to the DynamoDB Table
var likeArticle =  async function(request, response) {
    headline = request.body.headline
    currentuser = request.session.username
    console.log(headline)
    console.log(currentuser)


    db.postArticleLike(headline, currentuser, function(err, data){
        if(err){
            console.log(err)
        }
        else{
            console.log(data)
            response.send({success: true})
        }
    })
    
    
}

//route for getting all of a users news interests
var getInterests =  async function(request, response) {
    if( request.session.username ){
        currentuser = request.session.visitinguser
        
        console.log(currentuser)


    db.getLikedCategories(currentuser, function(err, data){
        if(err){
            console.log(err)
            response.send({error: 1, interests: "None"})
        }
        else{
            console.log(data)

            response.send({error: 0, interests: data})
        }
    })

    }
    else{
        response.render('/')
    }
   
    
    
    
}



//route for deleting a users news interests
var deleteInterests =  async function(request, response) {
    var otherdb = new AWS.DynamoDB();
    currentuser = request.session.username
    console.log(currentuser)


    db.getLikedCategories(currentuser, function(err, data){
        if(err){
            console.log(err)
            response.send({error: 1, interests: "None"})
        }
        else{
            console.log(data)
            for (let i = 0; i < data.Items.length; i++) {
                console.log(data.Items[i]["category"].S)
                console.log(data.Items[i]["userID"].S)

                var params = {
                    TableName: "NewsInterests",
                    Key: {
                        userID: {S:data.Items[i]["userID"].S },
                        category: {S: data.Items[i]["category"].S}
                    }
                }
                //delete old entry
                otherdb.deleteItem(params, function(err, data) {
                    if (err) {
                        callback(err);
                    } else {
                       console.log("wow")
                    }
                });
                
            }
            response.send({error: 0, interests: data})
        }
    })
    
    
}

//get the recommended articles for a user based on adsorption results
var getRecArticles =  async function(request, response) {
    
    currentuser = request.session.username
    console.log(currentuser)


    db.getRecommendedArticles(currentuser, function(err, data){
        if(err){
            console.log(err)
            response.send({error: 1, interests: "None"})
        }
        else{
            console.log("backend portion right here")
            console.log(data)
            var datarr = data.Items
            datarr.sort(function(a, b){return parseFloat(b["weight"].N) - parseFloat(a["weight"].N)});
            console.log(datarr);
            response.send({error: 0, interests: datarr})
        }
    })
    
    
}


//delete a liked article from the DynamoDB Table
var deleteLikedArticle =  async function(request, response) {
    currentuser = request.session.username
    headline = request.body.headline
    console.log(currentuser)
    console.log(headline)


    db.removeArticleLike(headline, currentuser, function(err, data){
        if(err){
            console.log(err)
            response.send({error: 1, interests: "None"})
        }
        else{
            response.send({error: 0, interests: data})
        }
    })
    
    
}

var newsRoutes = {

	searchNews: searchNews,
    likeArticle: likeArticle,
    createInterest: createInterest,
    getInterests: getInterests,
    deleteInterests: deleteInterests,
    getRecArticles: getRecArticles,
    deleteLikedArticle: deleteLikedArticle,
    setInterestSession: setInterestSession
}

module.exports = newsRoutes; 









