package edu.upenn.cis.nets2120.hw3.livy;



import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;


import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;


import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;


import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.catalyst.expressions.GenericRowWithSchema;
import org.apache.spark.sql.types.StructType;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.text.DateFormat;  
import java.text.SimpleDateFormat;  
import java.util.Date;  

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.hw3.livy.MyPair;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import edu.upenn.cis.nets2120.storage.DynamoConnector;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import scala.Tuple2;

public class SocialRankJob implements Job<Integer> {
    /**
     *
     */
    private static final long serialVersionUID = 1L;


    /**
     * Connection to Apache Spark
     */
    SparkSession spark;
	DynamoDB db;
	
	JavaSparkContext context;

	Table newtable;

	
	
	public SocialRankJob() {
		System.setProperty("file.encoding", "UTF-8");
	}

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 */

	
	//code for initializing the newsweights dynamoDB table
	private void initializeTables() throws InterruptedException {
		try {
			Table newtable = db.createTable(
			
			"NewsWeights", 
			Arrays.asList(new KeySchemaElement("userID", KeyType.HASH), new KeySchemaElement("headline", KeyType.RANGE)), 								
										
			Arrays.asList(new AttributeDefinition("userID", ScalarAttributeType.S), new AttributeDefinition("headline", ScalarAttributeType.S)),

			new ProvisionedThroughput(25L, 25L)); 

			newtable.waitForActive();
		} catch (final ResourceInUseException exists) {
			newtable = db.getTable("NewsWeights");
		}

	}

	//code for connecting to spark and DynamoDB. Also drops the current newsweights table and remakes it
	public void initialize() throws IOException, InterruptedException {
		System.out.println("Connecting to Spark...");

		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();

		System.out.println("Connecting to DynamoDB...");
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);


		System.out.println("Connected!");
		System.out.println("Resetting Table!");

		Table currtable;
		currtable = db.getTable("NewsWeights");
		currtable.delete();
		currtable.waitForDelete();
		initializeTables();




	}
	

	int runadsorption(){

		double delta = 0.001;
		int maxIters = 15;

		

		System.out.println("Adsorption Start");


		//begin by getting all node to node relationships from DynamoDB and converting them to PairRDDs
		ArrayList<String[]> output1 = new ArrayList<String[]>();
		Table NewsInterestsTable = db.getTable("NewsInterests");
		ItemCollection <ScanOutcome> items1 = NewsInterestsTable.scan();
		for(Item item: items1){
			String[] newtuple1 = new String[2];
			newtuple1[0] = item.getString("userID");
			newtuple1[1] = item.getString("category");
            output1.add(newtuple1);
            	
		}

		ArrayList<String[]> output2 = new ArrayList<String[]>();
		Table FriendsTable = db.getTable("Friends");
		ItemCollection <ScanOutcome> items2 = FriendsTable.scan();
		for(Item item: items2){
            	String[] newtuple2 = new String[2];
				newtuple2[0] = item.getString("followerID");
				newtuple2[1] = item.getString("followedID");
            	output2.add(newtuple2);

        }
		

		ArrayList<String[]> output3 = new ArrayList<String[]>();
		Table NewsLikesTable = db.getTable("NewsLikes");
		ItemCollection <ScanOutcome> items3 = NewsLikesTable.scan();
		for(Item item: items3){
           String[] newtuple3 = new String[2];
				newtuple3[0] = item.getString("userID");
				newtuple3[1] = item.getString("headline");
            	output3.add(newtuple3);
        }



		JavaPairRDD<String, String> uc = context.parallelize(output1).mapToPair(item-> new Tuple2<String, String>(item[0], item[1]));
		
		JavaPairRDD<String, String> u1u2 = context.parallelize(output2).mapToPair(item -> new Tuple2<String, String>(item[0], item[1]));
		JavaPairRDD<String, String> u2u1 = context.parallelize(output2).mapToPair(item -> new Tuple2<String, String>(item[1], item[0]));

		JavaPairRDD<String, String> ua = context.parallelize(output3).mapToPair(item -> new Tuple2<String, String>(item[0], item[1]));
		
		
		System.out.println("Reading news next");



		System.out.println("Table Data fetched");


		//init node transfer RDDs to determine outgoing weight distributions per node
		//for categories:  all outgoing edge weights add to 1, distributed evenly
		//for articles: all outgoing edge weights add to 1, distributed evenly
		//for users: uc weights sum to 0.3, ua weights sum to 0.4, uu weights sum to 0.3

		JavaPairRDD<String, String> uu = u1u2.union(u2u1).distinct();

		JavaPairRDD<String, Double> uuTransferRDD = uu.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0)); 
    	uuTransferRDD = uuTransferRDD.reduceByKey((a,b) -> a+b);
    	uuTransferRDD = uuTransferRDD.mapToPair(item -> new Tuple2<String, Double>(item._1, 0.3/item._2));

		JavaPairRDD<String, Double> uaTransferRDD = ua.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0)); 
    	uaTransferRDD = uaTransferRDD.reduceByKey((a,b) -> a+b);
    	uaTransferRDD = uaTransferRDD.mapToPair(item -> new Tuple2<String, Double>(item._1, 0.4/item._2));

		JavaPairRDD<String, Double> ucTransferRDD = uc.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0));
    	ucTransferRDD = ucTransferRDD.reduceByKey((a,b) -> a+b);
    	ucTransferRDD = ucTransferRDD.mapToPair(item -> new Tuple2<String, Double>(item._1, 0.3/item._2));


	
		JavaPairRDD<String, String> cat = context.parallelize(output1).mapToPair(item -> new Tuple2<String, String>(item[1], item[0])).union(getNewsfromTable().mapToPair(item -> new Tuple2<String, String>(item._2, item._1))).distinct();
		JavaPairRDD<String, String> art = context.parallelize(output3).mapToPair(item -> new Tuple2<String, String>(item[1], item[0])).union(getNewsfromTable()).distinct();
		

		JavaPairRDD<String, Double> categoryTransferRDD = cat.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0)); 
    	categoryTransferRDD = categoryTransferRDD.reduceByKey((a,b) -> a+b);
    	categoryTransferRDD = categoryTransferRDD.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0/item._2));
		
		JavaPairRDD<String, Double> articleTransferRDD = art.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0)); 
    	articleTransferRDD = articleTransferRDD.reduceByKey((a,b) -> a+b);
    	articleTransferRDD = articleTransferRDD.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0/item._2));

		//create edge transfer RDDs by mapping nodes to initial values

		System.out.println("Node Transfer RDDs created");
	    JavaPairRDD<String, Tuple2<String, Double>> uuEdgeTransfer = uu.join(uuTransferRDD);
		JavaPairRDD<String, Tuple2<String, Double>> uaEdgeTransfer = ua.join(uaTransferRDD);
	    JavaPairRDD<String, Tuple2<String, Double>> ucEdgeTransfer = uc.join(ucTransferRDD);


		JavaPairRDD<String, Tuple2<String, Double>> catEdgeTransfer = cat.join(categoryTransferRDD);
	    JavaPairRDD<String, Tuple2<String, Double>> artEdgeTransfer = art.join(articleTransferRDD);

		JavaPairRDD<String, Tuple2<String, Double>> edgeTransferRDD = 
		uuEdgeTransfer.union(uaEdgeTransfer).union(ucEdgeTransfer).union(catEdgeTransfer).union(artEdgeTransfer);

		
		
		//find every user with a category interest
		//users start with their own labels and an initial weight of 1

		JavaPairRDD <String, Tuple2<String, Double>> weights = uc.mapToPair(item -> new Tuple2<String, String>(item._1, item._1))
	    .join(uc.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0)));



		for(int x = 0; x < maxIters; x++) {

			//create a propogate RDD containing actual gained weight values and labels per node

			JavaPairRDD <String, Tuple2<String, Double>> propogateRDD = edgeTransferRDD.join(weights).mapToPair(item -> new Tuple2<String, Tuple2<String, Double>>(item._2._1._1, new Tuple2<String, Double>(item._2._2._1,item._2._1._2*item._2._2._2)));
			

			//determine new weights by reducing propogateRDD weights for each recipient
	    	JavaPairRDD <String, Tuple2<String, Double>> neweights = propogateRDD.mapToPair(item -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(item._1, item._2._1), item._2._2)).reduceByKey((a, b) -> a+b).mapToPair(item -> new Tuple2<String, Tuple2<String, Double>>(item._1._1, new Tuple2<String, Double>(item._1._2, item._2)));


			//set user weights to be equal to 1
			JavaPairRDD<Tuple2<String, String>, Double> eliminateusers = uc.mapToPair(
				item -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(item._1, item._1), 1.0));

			
		
	    	JavaPairRDD<Tuple2<String, String>, Double> compneweights = neweights.mapToPair(
				item -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(item._1, item._2._1), item._2._2)
			);

			JavaPairRDD<Tuple2<String, String>, Double> compneweightsnormalize = compneweights.subtractByKey(eliminateusers);

			
			JavaPairRDD <String, Tuple2<String, Double>> revertnormswitch = compneweightsnormalize.mapToPair(item ->
				new Tuple2<String, Tuple2<String, Double>>(item._1._1, new Tuple2<String, Double>(item._1._2, item._2))
			
			);

			JavaPairRDD <String, Tuple2<String, Double>> restoreuserweights = uc.mapToPair(item -> new Tuple2<String, String>(item._1, item._1))
	    	.join(uc.mapToPair(item -> new Tuple2<String, Double>(item._1, 1.0)));

			JavaPairRDD <String, Tuple2<String, Double>> normalizedweights = restoreuserweights.union(revertnormswitch);


			JavaPairRDD<Tuple2<String, String>, Double> compprevweights = weights.mapToPair(
				item -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(item._1, item._2._1), item._2._2)
			);

			

	    	JavaRDD<Double> compare = compneweights.join(compprevweights).map(
				item -> Math.abs(item._2._1 - item._2._2)
			);

			JavaPairRDD<String, Double> comparetesting = compneweights.join(compprevweights).mapToPair(
				item -> (new Tuple2<String, Double>( item._1._2 +" "+ item._1._1,Math.abs(item._2._1 - item._2._2)))
			);


			//check for convergence 

			if(compare.count() != 0){
				Tuple2<String, Double> maxdiff = comparetesting.reduce((Tuple2<String, Double> val1, Tuple2<String, Double> val2) -> new Tuple2<String, Double>(val1._1, Math.max(val1._2, val2._2)));

				//System.out.println("maxdiff = " + maxdiff._1 + " ," + maxdiff._2);

				weights = normalizedweights;

				if(maxdiff._2 <= delta) {
					break;
				}
			}
			else{
				weights = normalizedweights;
			}

			//filter weights that are too small

			weights = weights.filter(item -> item._2._2 > .005);

			
			 
			
		}

		// join article weights with the article URLs

		JavaPairRDD<String, Tuple2<Tuple2<String, Double>, String>> articleweights = weights.join(getLinkfromTable());

	
		//push all weights to the DynamoDB table
		System.out.println("finalRDD");
		
		articleweights.foreachPartition(
			partition -> {

				System.out.println("_______________________________________");
				
				DynamoDB dbcopy = DynamoConnector.getConnection(Config.DYNAMODB_URL);
				
				int counter = 0;
				
				ArrayList<Item> items = new ArrayList<Item>();
				
				while(partition.hasNext()) {

					Tuple2<String, Tuple2<Tuple2<String, Double>, String>> structure = partition.next();
					System.out.println(structure);

					String username = structure._2._1._1;
					String url = structure._2._2;
					Double weight = structure._2._1._2;
					String articlename = structure._1;

						counter = counter + 1;
						
						if (counter == 23) {

							
						TableWriteItems tableWriteItems = new TableWriteItems("NewsWeights")
						 			.withItemsToPut(
						 				items);
							
						BatchWriteItemOutcome outcome = dbcopy.batchWriteItem(tableWriteItems);
						items.clear();
						counter = 0;


						}
						
						Item newitem = new Item()
							.withPrimaryKey("userID", username, "headline", articlename) 
							.withNumber("weight", weight)
							.withString("url", url);
						
						items.add(newitem);

				}

				if(items.size() != 0){
					TableWriteItems tableWriteItems = new TableWriteItems("NewsWeights")
 					    .withItemsToPut(
 					        items);
 				
 				BatchWriteItemOutcome outcome = dbcopy.batchWriteItem(tableWriteItems);

				}

				
			}
		);

		return 1;
		
	}
	//gets all article links from the dynamodb table
	JavaPairRDD<String, String> getLinkfromTable() {
		ArrayList<Tuple2<String, String>> output = new ArrayList<Tuple2<String, String>>();

		Table currtable = db.getTable("NewsRec");
		
		Date currdate = new Date();
		currdate.setYear(currdate.getYear()-5);
		DateFormat structdate = new SimpleDateFormat("yyyy-MM-dd");
		String currdatestr = structdate.format(currdate);

		System.out.println(currdatestr);

		QuerySpec spec = new QuerySpec()
    		.withKeyConditionExpression("articledate = :v_id")
    		.withValueMap(new ValueMap()
        	.withString(":v_id", currdatestr));

		ItemCollection <QueryOutcome> items = currtable.query(spec);

		for(Item item: items){
			Tuple2<String, String> newtuple = new Tuple2<String, String>(item.getString("headline"), item.getString("link"));
            	output.add(newtuple);

		}
        return context.parallelize(output).mapToPair(item -> new Tuple2<String, String>(item._1, item._2));

	}

	//gets article headlines from the dynamoDB table
	JavaPairRDD<String, String> getNewsfromTable() {
		ArrayList<Tuple2<String, String>> output = new ArrayList<Tuple2<String, String>>();
		

		Table currtable = db.getTable("NewsRec");
		Date currdate = new Date();
		currdate.setYear(currdate.getYear()-5);
				DateFormat structdate = new SimpleDateFormat("yyyy-MM-dd");
		String currdatestr = structdate.format(currdate);

		System.out.println(currdatestr);

		QuerySpec spec = new QuerySpec()
    		.withKeyConditionExpression("articledate = :v_id")
    		.withValueMap(new ValueMap()
        	.withString(":v_id", currdatestr));

		ItemCollection <QueryOutcome> items = currtable.query(spec);

		for(Item item: items){
			Tuple2<String, String> newtuple = new Tuple2<String, String>(item.getString("headline"), item.getString("category"));
            output.add(newtuple);

		}
	
        return context.parallelize(output).mapToPair(item -> new Tuple2<String, String>(item._1, item._2));

	}

	


    public Integer run() throws IOException, InterruptedException {
		
		System.out.println("Running");
		runadsorption();
		return 1;
		
	}


    /**
     * Initialize the database connection and open the file
     *
     * @throws IOException
     * @throws InterruptedException
     */
   
    
    @Override
    public Integer call(JobContext arg0) throws Exception {
            initialize();
			return run();
    }


}