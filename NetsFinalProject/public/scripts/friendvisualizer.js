

/* This is responsible for displaying the visualzier. It also has
event listener respnsible for displaying friends when a node is 
clicked */


    $(document).ready(function() {
        

        $.get('/friendvisualization', 
        
        function(myData) {
            var container = document.getElementById('mystuff');
        
            var options = {};

            console.log("MY DATA DSJKFBSDKBDFBFK", data)

            
            
            var nodes = new vis.DataSet(myData.nodes)
            var edges = new vis.DataSet(myData.edges)
            var data = {
                nodes: nodes,
                edges: edges,
            };

            var network = new vis.Network(container, data, options);

            
            network.on("click", function (params) {
                var nodeID = params.nodes[0]
                
                if (nodeID) {
                    
                    $.post('/getMoreFriends', {
                        myNodes: nodes.get(),
                        friendID: nodeID
                    }, function(data) {
                        nodes.update(data.nodes)
                        edges.update(data.edges)
                    })
                }
            })
        })
    })
    



