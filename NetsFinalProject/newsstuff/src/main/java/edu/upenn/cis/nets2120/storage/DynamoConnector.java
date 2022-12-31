package edu.upenn.cis.nets2120.storage;



import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.auth.SystemPropertiesCredentialsProvider;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;

import edu.upenn.cis.nets2120.config.Config;

/**
 * A factory 
 * @author zives
 *
 */
public class DynamoConnector {
	/**
	 * A logger is useful for writing different types of messages
	 * that can help with debugging and monitoring activity.  You create
	 * it and give it the associated class as a parameter -- so in the
	 * config file one can adjust what messages are sent for this class. 
	 */
	
	/**
	 * This inner class is responsible for setting up a local copy of
	 * DynamoDB.  We don't really want the average developer to use it
	 * so we'll make it a private inner class, only used by the factory
	 * as need be.
	 *  
	 * @author zives
	 *
	 */

	/**
	 * In case we need to run a DynamoDB Local server, here's an object
	 */

	/**
	 * This is our connection
	 */
	static DynamoDB client;

	/**
	 * Singleton pattern: get the client connection if one exists, else create one
	 * 
	 * @param url
	 * @return
	 */
	public static DynamoDB getConnection(final String url) {
		if (client != null)
			return client;
		
		// Are we running the local "dummy" client?  If so we put in fake AWS credentials and a fake region.
		if (Config.LOCAL_DB) {
			
		} else {
	    	client = new DynamoDB( 
	    			AmazonDynamoDBClientBuilder.standard()
					.withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(
						Config.DYNAMODB_URL, "us-east-1"))
        			.withCredentials(new DefaultAWSCredentialsProviderChain())
					.build());
		}

    	return client;
	}
	
	/**
	 * Orderly shutdown
	 */
	public static void shutdown() {
		if (client != null) {
			client.shutdown();
			client = null;
		}
		
	}
}
