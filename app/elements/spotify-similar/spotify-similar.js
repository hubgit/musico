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

        this.z = -100;

        this.nodes = {};

        this.graph = {
            nodes: [],
            links: []
        };

        this.$.search.blur();

        this.search(this.artist).then(this.similar.bind(this)).then(this.draw.bind(this));
    },
    parseArtist: function(artist) {
        return {
            id: artist.uri,
            uri: artist.uri,
            href: artist.href,
            name: artist.name,
            popularity: artist.popularity,
        };
    },
    search: function(name) {
        var normalisedName = name.toLowerCase().trim().replace(/[^\w\s]/g, '');

        var resource = new Resource('https://api.spotify.com/v1/search', {
            q: '"' + name + '"',
            type: 'artist',
            limit: 10,
        });

        return resource.get('json').then(function(data) {
            this.error = null;

            if (!data.artists || !data.artists.items || !data.artists.items.length) {
                this.error = 'No matching artists found';
            }

            var nameMatches = data.artists.items.filter(function(item) {
                return item.name.toLowerCase().trim().replace(/[^\w\s]/g, '') === normalisedName;
            });

            var artist = nameMatches.length ? nameMatches[0] : data.artists.items[0];

            artist = this.parseArtist(artist);

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

        var el = this.$.graph;
        var container = d3.select(el);

        var width = this.$.graph.offsetWidth;
        var height = this.$.graph.offsetHeight;

        var tick = function() {
            //force.tick();
            //force.tick();
            force.tick();
            requestAnimationFrame(draw);

            if (force.alpha() > 0) {
                requestAnimationFrame(tick);
            }
        };

        var force = d3.layout.force()
            .linkDistance(50)
            .charge(-1000)
            //.friction(0.1)
            .size([width, height])
            .nodes(this.graph.nodes)
            .links(this.graph.links)
            .on('start', tick);

        var main = container
            .append('div').attr('class', 'main')
            .attr('style', 'position: relative; width:' + width + 'px; height:' + height + 'px');

        var labelsElement = main.append('div').attr('class', 'labels');
        var labelsNode = this.shadowRoot.querySelector('.labels');

        var labels = labelsElement.selectAll('.label');
        
        var zoom = d3.behavior.zoom()
            //.scaleExtent([10, 10])
            .on('zoom', function() {
                var transform = 'translate(' + d3.event.translate[0] + 'px,' + d3.event.translate[1] + 'px) scale(' + d3.event.scale + ')';

                labelsNode.style.transform = transform;
                labelsNode.style['-webkit-transform'] = transform;
            }.bind(this));

        main.call(zoom);

        var draw = function() {
            var z = this.z;

            labels.attr('style', function(d) {
                var transform = 'translate3d(' + (d.x - (this.offsetWidth / 2)) + 'px,' + d.y + 'px,' + (z + d.popularity * 5) + 'px)';

                return 'transform: ' + transform + '; -webkit-transform: ' + transform;
            }).attr('data-expanded', function(d) {
                return d.expanded ? 'true' : 'false';
            }).attr('data-selected', function(d) {
                return d.selected ? 'true' : 'false';
            });
        }.bind(this);

        var run = function() {
            labels = labels.data(this.graph.nodes, function(d) {
                return d.uri;
            });

            //labels.exit().remove();

            labels.enter().append('span')
                .attr('class', 'label')
                .append('span')
                .call(force.drag)
                .text(function(d) {
                    return d.name;
                })
                .on('click', function(d) {
                    if (d3.event.defaultPrevented) {
                        return; // ignore drag
                    }

                    this.selected = d.id;

                    d.selected = true;

                    labels.attr('data-selected', function(d) {
                        return d.selected ? 'true' : 'false';
                    });

                    if (!d.expanded) {
                        this.similar(d).then(function() {
                            this.z -= 10;
                            run();
                        }.bind(this));
                    }
                }.bind(this));

            force.start();
        }.bind(this);

        run();
    }
});
