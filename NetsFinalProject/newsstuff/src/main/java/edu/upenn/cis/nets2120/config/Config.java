package edu.upenn.cis.nets2120.config;

/**
 * Global configuration for NETS 2120 homeworks.
 * 
 * A better version of this would read a config file from the resources,
 * such as a YAML file.  But our first version is designed to be simple
 * and minimal. 
 * 
 * @author zives
 *
 */
public class Config {

	/**
	 * The path to the space-delimited social network data
	 */
	public static String SOCIAL_NET_PATH = "demo.txt";

	public static String NEWS_PATH = "News_Category_Dataset_v2.json";

	
	public static String BIGGER_SOCIAL_NET_PATH = "s3a://nets2120/soc-LiveJournal1.txt";
	
	public static String LOCAL_SPARK = "local[*]";

	public static Boolean LOCAL_DB = false;

	public static String DYNAMODB_URL = "https://dynamodb.us-east-1.amazonaws.com";


	/**
	 * How many RDD partitions to use?
	 */
	public static int PARTITIONS = 5;
}
