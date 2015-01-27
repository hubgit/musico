'use strict';

Polymer({
    ready: function() {
        this.graph = {};
        this.nodes = {};
        this.$.search.focus();
        //this.fetchCollection();
    },
    fetchCollection: function(e) {
        if (e) {
            e.preventDefault();
        }

        this.z = 0;

        this.nodes = {};

        this.graph = {
            nodes: [],
            links: []
        };

        this.search(this.artist).then(this.similar.bind(this)).then(this.draw.bind(this));
    },
    parseArtist: function(artist) {
        return {
            id: artist.uri,
            uri: artist.uri,
            href: artist.href,
            name: artist.name,
        }
    },
    search: function(name) {
        var resource = Resource('https://api.spotify.com/v1/search', {
            q: name,
            type: 'artist',
            limit: 1,
        });

        return resource.get('json').then(function(data) {
            this.error = null;

            if (!data.artists || !data.artists.items || !data.artists.items.length) {
                this.error = 'No matching artists found';
            }

            var artist = this.parseArtist(data.artists.items[0]);

            this.selected = artist.id;

            if (!this.nodes[artist.uri]) {
                this.nodes[artist.uri] = artist;
                this.graph.nodes.push(artist);
            }

            return artist;
        }.bind(this));
    },
    similar: function(source) {
        source.expanded = true;

        var resource = new Resource(source.href + '/related-artists');

        return resource.get('json').then(function(data) {
            data.artists.forEach(function(artist) {
                artist = this.parseArtist(artist);

                if (!this.nodes[artist.uri]) {
                    this.nodes[artist.uri] = artist;
                    this.graph.nodes.push(artist);
                }

                this.graph.links.push({
                    source: this.nodes[source.uri],
                    target: this.nodes[artist.uri]
                });
            }.bind(this));

            return true;
        }.bind(this), function(err) {
            console.err(err);
        });
    },
    draw: function() {
        var existing = this.$.graph.querySelector('.main');

        if (existing) {
            existing.parentNode.removeChild(existing);
        }

        var width = this.$.graph.offsetWidth;
        var height = this.$.graph.offsetHeight;

        var force = d3.layout.force()
            .linkDistance(50)
            .charge(-1000)
            //.friction(0.1)
            .size([width, height])
            .nodes(this.graph.nodes)
            .links(this.graph.links)
            .on('start', tick);

        var container = d3.select(this.$.graph)
            .append('div').attr('class', 'main')
            .attr('style', 'position: relative; width:' + width + 'px; height:' + height + 'px');

        var labelsElement = container.append('div').attr('class', 'labels');

        var labels = labelsElement.selectAll('.label');

        var draw = function() {
            var z = this.z;

            labels.attr('style', function(d) {
                var transform = 'translate3d(' + (d.x - (this.offsetWidth / 2)) + 'px,' + d.y + 'px,' + z + 'px)';
                
                return 'transform: ' + transform + '; -webkit-transform: ' + transform;
            }).attr('data-expanded', function(d) {
                return d.expanded ? 'true' : 'false'
            })
        }.bind(this);

        function tick() {
            //force.tick();
            //force.tick();
            force.tick();
            requestAnimationFrame(draw);

            if (force.alpha() > 0) {
                requestAnimationFrame(tick);
            }
        }

        var run = function() {
            labels = labels.data(this.graph.nodes, function(d) {
                return d.uri;
            })

            //labels.exit().remove();

            var spans = labels.enter().append('span')
                .attr('class', 'label')
                .append('span')
                .text(function(d) {
                    return d.name;
                })
                .on('click', function(d) {
                    this.selected = d.id;
                    this.z -= 10;

                    if (!d.expanded) {
                        this.similar(d).then(run.bind(this));
                    }
                }.bind(this));

            force.start();
        }.bind(this);

        run();
    }
})
