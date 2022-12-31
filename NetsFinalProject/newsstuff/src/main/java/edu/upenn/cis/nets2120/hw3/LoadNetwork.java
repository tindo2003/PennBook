package edu.upenn.cis.nets2120.hw2;


import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.api.java.function.PairFunction;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.catalyst.expressions.GenericRowWithSchema;
import org.apache.spark.sql.types.StructType;

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

import com.opencsv.CSVParser;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.DynamoConnector;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import opennlp.tools.stemmer.PorterStemmer;
import opennlp.tools.stemmer.Stemmer;
import opennlp.tools.tokenize.SimpleTokenizer;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

public class LoadNetwork {
	/**
	 * The basic logger
	 */
	static Logger logger = LogManager.getLogger(LoadNetwork.class);

	/**
	 * Connection to DynamoDB
	 */
	DynamoDB db;
	Table talks;
	
	CSVParser parser;

	

	
	
	
	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;
	
	/**
	 * Helper function: swap key and value in a JavaPairRDD
	 * 
	 * @author zives
	 *
	 */
	static class SwapKeyValue<T1,T2> implements PairFunction<Tuple2<T1,T2>, T2,T1> {

		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;

		@Override
		public Tuple2<T2, T1> call(Tuple2<T1, T2> t) throws Exception {
			return new Tuple2<>(t._2, t._1);
		}
		
	}
	
	public LoadNetwork() {
		System.setProperty("file.encoding", "UTF-8");
		parser = new CSVParser();

	}
	
	private void initializeTables() throws DynamoDbException, InterruptedException {
		try {
			talks = db.createTable("ted_talks", Arrays.asList(new KeySchemaElement("talk_id", KeyType.HASH)), // Partition
																												// key
					Arrays.asList(new AttributeDefinition("talk_id", ScalarAttributeType.N)),
					new ProvisionedThroughput(25L, 25L)); // Stay within the free tier

			talks.waitForActive();
		} catch (final ResourceInUseException exists) {
			talks = db.getTable("ted_talks");
		}

	}
	

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 * @throws DynamoDbException 
	 */
	public void initialize() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Connecting to DynamoDB...");
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();

				
		logger.debug("Connected!");
	}
	

	
	
	//function for loading the keyword to article dynamoDB table
	public void runkeywords() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Running");


		System.out.println("wow2");

		JavaRDD<Row> newsarticles = spark.read().json(Config.NEWS_PATH).toJavaRDD().distinct();

		System.out.println("wow");

		System.out.println("wow2");




		newsarticles.foreachPartition(
			partition -> {



					System.out.println("wowx");

				
				DynamoDB dbcopy = DynamoConnector.getConnection(Config.DYNAMODB_URL);
				
				int counter = 0;

				
				
				
				while(partition.hasNext()) {


					SimpleTokenizer model;

					model = SimpleTokenizer.INSTANCE;

					String[] tokenized = {};


					System.out.println("beginning partition");
										
					Row item = partition.next();

					String headline = item.getString(3);
					String authors = item.getString(0);
					String description = item.getString(5);
					String category = item.getString(1);
					String url = item.getString(4);


					HashSet<String> copied = new HashSet<String>();

					
					ArrayList<String> words = new ArrayList<String>();
					String[] stopwords = {"a", "all", "any", "but", "the"};
					ArrayList<String> stopwordlist = new ArrayList(Arrays.asList(stopwords));
					PorterStemmer stem = new PorterStemmer();	
						
					System.out.println(headline);
					
					tokenized = model.tokenize(headline);

					for (String word: tokenized) {
						if(word.matches("[a-zA-Z]+") && stopwordlist.contains(word) == false){
							word = word.toLowerCase();
							word = stem.stem(word);
							if(copied.contains(word) == false) {
								words.add(word);
								copied.add(word);
							}
						}
					}

					 tokenized = model.tokenize(authors);
							
					for (String word: tokenized) {
						if(word.matches("[a-zA-Z]+") && stopwordlist.contains(word) == false){
							word = word.toLowerCase();
							word = stem.stem(word);
							if(copied.contains(word) == false) {
								words.add(word);
								copied.add(word);
							}
						}
					}

					tokenized = model.tokenize(description);
							
					for (String word: tokenized) {
						if(word.matches("[a-zA-Z]+") && stopwordlist.contains(word) == false){
							word = word.toLowerCase();
							word = stem.stem(word);
							if(copied.contains(word) == false) {
								words.add(word);
								copied.add(word);
							}
						}
					}
					
					
					counter = 0;
					ArrayList<Item> items = new ArrayList<Item>();
					
					for (String keyword: words){

						System.out.println(keyword);
						counter = counter + 1;
						
						if (counter == 23) {
							
						TableWriteItems tableWriteItems = new TableWriteItems("NewsSearch")
						 			.withItemsToPut(
						 				items);
							
						BatchWriteItemOutcome outcome = dbcopy.batchWriteItem(tableWriteItems);
						items.clear();
						counter = 0;

						Thread.sleep(2500);


						}
						
						Item newitem = new Item()
							.withPrimaryKey("keyword", keyword, "headline", headline) 
							.withString("url", url);
						
						items.add(newitem);
						
					}

	
 				}
 				
 				
 				
 				
 				
 			});
	}

	//function for loading the news DynamoDB Table with news content
	public void run() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Running");


		JavaRDD<Row> newsarticles = spark.read().json(Config.NEWS_PATH).toJavaRDD().distinct();

		
		newsarticles.foreachPartition(
			partition -> {
				
				DynamoDB dbcopy = DynamoConnector.getConnection(Config.DYNAMODB_URL);
				
				int counter = 0;
				
				ArrayList<Item> items = new ArrayList<Item>();
				
				while(partition.hasNext()) {
					

					if (counter == 22) {
						System.out.println("__________________________");
						System.out.println("__________________________");

						
						Thread.sleep(1000);
						
						TableWriteItems tableWriteItems = new TableWriteItems("News")
							    .withItemsToPut(
							        items);
						
						BatchWriteItemOutcome outcome = dbcopy.batchWriteItem(tableWriteItems);
						items.clear();
						counter = 0;

						Thread.sleep(1000);

					}

					
					Row item = partition.next();
	
 					if (item != null) {
						System.out.println(item.getString(3));
 						
 					Item tableitem = new Item()
					 	.withPrimaryKey("headline", item.getString(3), "date", item.getString(2))
 						.withString("authors",item.getString(0))
 						.withString("category", item.getString(1))
 						.withString("link", item.getString (4))
 						.withString("short_description", item.getString(5));
 					
					if(item.getString(3).length() != 0 && item.getString(2).length() != 0){
						items.add(tableitem);
					}
 					
 					counter = counter + 1;
 					
 					}
 				}
 				
 				
 				TableWriteItems tableWriteItems = new TableWriteItems("News")
 					    .withItemsToPut(
 					        items);
 				
 				BatchWriteItemOutcome outcome = dbcopy.batchWriteItem(tableWriteItems);
 				
 				
 			});
	}



	

	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");
		
		DynamoConnector.shutdown();
		
		if (spark != null)
			spark.close();
	}
	
	public static void main(String[] args) {
		final LoadNetwork ln = new LoadNetwork();

		try {
			ln.initialize();
			ln.run();
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final DynamoDbException e) {
			e.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			ln.shutdown();
		}
	}

}
