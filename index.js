var svg = d3.select('svg'),
    svgNode = svg.node().getBoundingClientRect(),
    width = svgNode.width,
    height = svgNode.height,
    duration = 2000,
    colorNameScale = d3.scaleOrdinal(d3.schemeCategory20)
    colorDepthScale = d3.scaleSequential(d3.interpolateViridis).domain([-4, 4])

svg = svg.append('g')

d3.json("flare.json", function(error, flare) {
    if (error) throw error;

    showreel(flare)
});

function showreel(flare){
    treeMap(flare)
    .then(changeRectToCirc)
    .then(()=>bubbleChart(flare))
    .then(()=>circlePack(flare))
    .then(shrink)
    .then(()=>radialTree(flare))
    .then(endShowreel)
    .then(()=>showreel(flare))
}

function treeMap(flare){
    return new Promise(resolve=>{

        var treemap = d3.treemap()
            .tile(d3.treemapResquarify)
            .size([width, height])
            .round(true)
            .paddingInner(1);

        var root = d3.hierarchy(flare)
            .eachBefore(d=>d.data.id = (d.parent ? d.parent.data.name + "." : "") + d.data.name)
            .sum(d=>d.size)
    
        treemap(root);
        
        var cell = svg.selectAll("g")
            .data(root.leaves())
            .enter().append("g")
            .attr('class','node')
            .attr("transform", d=>"translate(" + d.x0 + "," + d.y0 + ")")
            .style("opacity",0)
            .sort((a,b)=>((a.x0) - (b.x0)) + ((b.y0) - (a.y0)))
        
        cell.append("rect")
            .attr("id",d=>d.data.name)
            .attr("width",d=>d.x1 - d.x0)
            .attr("height",d=>d.y1 - d.y0)
            .attr("fill",d=>colorNameScale(d.parent.data.name));
        
        cell.transition().duration((d,i)=>Math.random() * (1000 - 500) + 500)
            .delay((d,i)=>Math.random() * (1000 - 100) + 100)
            .style("opacity",1)
            .call(endAll,sumByCount)

        function sumByCount(){

            treemap(root.sum(d=>d.children ? 0 : 1));
            cell.transition()
                .duration(duration)
                .attr("transform",d=>"translate(" + d.x0 + "," + d.y0 + ")")
            .select("rect")
                .attr("width",d=>d.x1 - d.x0)
                .attr("height",d=>d.y1 - d.y0)
                .call(endAll,resolve)
        }
    })
}


function changeRectToCirc(){
    return new Promise(resolve=>{

        var node = svg.selectAll('.node')
        node.select('rect')
            .attr('rx','0')
            .attr('ry','0')
            .transition().duration(duration/3).ease(d3.easeCubicIn)
            .attr("x",d=>(d.x1 - d.x0)/2)
            .attr("y",d=>(d.y1 - d.y0)/2)
            .attr('width','10px')
            .attr('height','10px')
            .transition().duration(duration/4).ease(d3.easeCubicOut)
            .attr('rx','5px')
            .attr('ry','5px')
            .call(endAll,replace) 
            
            
        function replace(){
            node.append('circle')
                .attr('r',5)
                .attr("cx",d=>(d.x1 - d.x0)/2 + 5)
                .attr("cy",d=>(d.y1 - d.y0)/2 + 5)
                .attr("fill",d=>colorNameScale(d.parent.data.name))
            node.select('rect').remove()

            resolve()
        }
        
    })
}

//bubbles drop down, bottom to top
function bubbleChart(flare){
    return new Promise(resolve=>{

        var pack = d3.pack()
            .size([width, height])
            .padding(1.5);

        var flatData = []
        d3.hierarchy(flare)
            .each(d=>{
                if(!d.children)
                    flatData.push({ name: d.data.name, parent: d.parent.data.name, size: d.data.size })
            })

        var root = d3.hierarchy({children: flatData}).sum(d=>d.size)
        
        let packData = pack(root)
        
        var node = svg.selectAll(".node")
            .data(packData.leaves(),d=>d.data.name)
        
        //node.append('text').text(d=>d.data.name)
        
        node.transition()
            .duration(duration)
            .delay((d,i)=>i*2.5)
            .style('opacity',1)
            .attr("transform", d=>"translate(" + d.x + "," + d.y + ")")
        .select('circle')
            .attr("r", d=>d.r)
            .attr("cx",0)
            .attr("cy",0)
            .call(endAll, ()=>setTimeout(resolve,500));
    })
}

//leaf nodes gather together, then reveal parents
function circlePack(flare){
    return new Promise(resolve=>{
        
        var pack = d3.pack()
            .size([width, height])
            .padding(2.5);
        var root = d3.hierarchy(flare).sum(d=>d.size).sort((a,b)=>b.value - a.value)
        
        var node = svg.selectAll(".node")
            .data(pack(root).descendants(),d=>d.data.name)
        
        //entering nodes are only parents
        let nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", d=>"translate(" + d.x + "," + d.y + ")")
        nodeEnter.append("circle")
            .attr("r", d=>d.r)
            .style('stroke','transparent')
            .style('stroke-width','1.5px')
            .style('fill','transparent')
        
        node = node.merge(nodeEnter).order()

        node.transition()
            .duration(duration)
                .attr("transform", d=>"translate(" + d.x + "," + d.y + ")")
            .select('circle')
                .attr("r", d=>d.r)
                .style("fill", d=>colorDepthScale(d.depth))
            .call(endAll, revealParents)

        function revealParents(){
            nodeEnter.selectAll('circle')
                .transition()
                .duration(duration/2)
                    .style('fill',d=>colorDepthScale(d.depth))
                .call(endAll, resolve);
        }
    })
}

function shrink(){
    return new Promise(resolve=>{
        svg.selectAll('.node circle')
            .transition()
            .duration(duration/2)
            .attr('r',2.5)
            .on('end',resolve)
    })
}

    function radialTree(flare){
    return new Promise(resolve=>{
        var root = d3.hierarchy(flare).sum(d=>d.size).sort((a,b)=>b.value - a.value)

        var tree = d3.tree()
            .size([2 * Math.PI, 425])
            .separation((a,b)=>(a.parent == b.parent ? 1 : 2) / a.depth);
        
        root = tree(root);
        
        svg.transition().duration(duration)
            .attr('transform',`translate(${width/2} ${height/2})`)
        
        var node = svg.selectAll(".node")
            .data(root.descendants(),d=>d.data.name)
            .attr("class", d=>"node" + (d.children ? " node--internal" : " node--leaf"))

        node.transition()
            .duration(duration)
                .attr("transform", d=>"translate(" + radialPoint(d.x, d.y) + ")")
                .select('circle')
                .attr('r',2.5)
                .call(endAll,showLinks)
        
        function showLinks(){
            var pathLengths = []
            let pathDuration = duration/root.descendants()[0].height
            
            svg.selectAll(".link")
                .data(root.links())
                .enter().append("path")
                .attr("class", "link")
                //.style('opacity',0)
                .attr("d", d3.linkRadial()
                    .angle(d=>d.x)
                    .radius(d=>d.y))
                .each(function(){
                    var length = d3.select(this).node().getTotalLength()
                    pathLengths.push(length)
                })
                .attr("stroke-dasharray",(d,i)=> pathLengths[i] + " " + pathLengths[i])
                .attr("stroke-dashoffset",(d,i)=> pathLengths[i])
            .transition()
            .duration(pathDuration)
            .delay(d=>d.source.depth * pathDuration)
            .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0)
                .call(endAll,  ()=>setTimeout(resolve,500));
        }
        /* 
        node.append("text")
            .attr("dy", "0.31em")
            .attr("x", function(d) { return d.x < Math.PI === !d.children ? 6 : -6; })
            .attr("text-anchor", function(d) { return d.x < Math.PI === !d.children ? "start" : "end"; })
            .attr("transform", function(d) { return "rotate(" + (d.x < Math.PI ? d.x - Math.PI / 2 : d.x + Math.PI / 2) * 180 / Math.PI + ")"; })
            .text(function(d) { return d.id.substring(d.id.lastIndexOf(".") + 1); }); */
    })


    function radialPoint(x, y) {
        return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
    }
}


function changeCircToRect(){
    return new Promise(resolve=>{

        var node = svg.selectAll('.node')
        node.append('rect')
            .attr('x','-2.5')
            .attr('y','-2.5')
            .attr('rx','50%')
            .attr('width','5px')
            .attr('height','5px')
            .style("fill", d=>color(d.depth))
        node.select('circle').remove()
    })
}
//transitioning to scale(0) breaks rotate
function endShowreel(){
    return new Promise(resolve=>{
        svg.attr('transform',`translate(${width/2},${height/2})`)
        .transition().duration(duration)
        .attr('transform',`translate(${width/2},${height/2})scale(0.01)rotate(180)`)
        .style('opacity',0)
        .on('end',()=>{
            svg.attr('transform',null).style('opacity',1)
                .selectAll('*').remove()
            resolve()
        })
    })
}

function endAll (transition, callback) {
    var n;
    if (transition.empty()) {
        callback();
    }
    else {
        n = transition.size();
        transition.on("end", function () {
            n--;
            if (n === 0) {
                callback();
            }
        });
    }
}

function shuffle(array) {
    var m = array.length, t, i;
    while (m) {
      i = Math.floor(Math.random() * m--);
      t = array[m];
      array[m] = array[i];
      array[i] = t;
    }
  }