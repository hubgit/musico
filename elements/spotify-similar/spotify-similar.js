'use strict';

Polymer({
    ready: function() {
        this.graph = {};
        this.nodes = {};
        this.$.search.focus();
        //this.fetchCollection();
    },
    focus: function() {
        this.searching = true;
    },
    blur: function() {
        this.searching = false;
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

        this.selected = [];

        this.$.search.blur();

        this.search(this.artist).then(this.similar.bind(this)).then(this.draw.bind(this));
    },
    parseArtist: function(artist) {
        artist.id = artist.uri;

        return artist;
    },
    bestImage: function(images) {
        images.forEach(function(image) {
            image.diff = Math.abs(400 - image.width);
        })

        images.sort(function(a, b) {
            return a.diff - b.diff;
        });

        return images.length ? images[0].url : 'images/placeholder.png';
    },
    addSelection: function(artist) {
        var image = this.bestImage(artist.images);

        //this.topTrackImage(artist).then(function(image) {
            this.selected.push({
                name: artist.name,
                id: artist.id.replace(/^spotify:artist:/, ''),
                image: image,
            });

            if (this.selected.length > 10) {
                this.async(function() {
                    this.selected = this.selected.slice(-10);
                });
            }
        //}.bind(this));
    },
    topTrackImage: function(artist) {
        var resource = new Resource(artist.href + '/top-tracks', {
            country: 'gb',
        });

        return resource.get('json').then(function(data) {
            if (!data.tracks.length) {
                return this.bestImage(artist.images);
            }

            var album = data.tracks[0].album;

            return this.bestImage(album.images);
        }.bind(this));
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

            this.addSelection(artist);

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
            .linkDistance(70)
            .charge(-800)
            .friction(0.5)
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
                //var transform = 'translate3d(' + (d.x - (this.offsetWidth / 2)) + 'px,' + d.y + 'px,' + (z + d.popularity * 5) + 'px)';
                var transform = 'translate3d(' + (d.x - (this.offsetWidth / 2)) + 'px,' + d.y + 'px, 0)';

                var size = 10 + ((d.popularity / 40) * 5) + 'px';

                var styles = [
                    'transform:' + transform,
                    '-webkit-transform:' + transform,
                    'font-size:' + size
                ];

                return styles.join(';');
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

                    this.addSelection(d);

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
