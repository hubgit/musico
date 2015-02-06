'use strict';

Polymer({
    images: false,
    ready: function() {
        this.$.graph.expand = this.expand.bind(this);
        this.$.graph.nodeSize = this.nodeSize;
        this.$.search.focus();
        this.selected = [];
        this.images = this.$.graph.clientWidth > 800;
        this.preload();
    },
    submit: function(e) {
        e.preventDefault();
        this.$.search.blur();
        this.$.graph.reset();
        this.selected = [];
        this.search(this.artist).then(function(artist) {
            this.$.graph.click(artist);
        }.bind(this));
    },
    expand: function(source) {
        this.addSelection(source);

        return this.similar(source);
    },
    nodeSize: function(d) {
        return 11 + ((d.popularity / 40) * 5) + 'px';
    },
    bestImage: function(images) {
        images.forEach(function(image) {
            image.diff = Math.abs(400 - image.width);
        });

        images.sort(function(a, b) {
            return a.diff - b.diff;
        });

        return images.length ? images[0].url : 'images/placeholder.png';
    },
    addSelection: function(artist) {
        artist.selected = true;

        var identifier = artist.id.replace(/^spotify:artist:/, '');

        var existing = this.selected.some(function(item) {
            return item.id === identifier;
        });

        if (existing) {
            return;
        }

        this.selected.push({
            name: artist.name,
            id: identifier,
            image: this.bestImage(artist.images),
        });

        if (this.selected.length > 5) {
            this.async(function() {
                this.selected = this.selected.slice(-5);
            });
        }
    },
    parse: function(artist) {
        artist.id = artist.uri;

        return artist;
    },
    params: function() {
        return window.location.search.substr(1).split(/&/).reduce(function(output, part) {
            var parts = part.split(/=/);
            var key = decodeURIComponent(parts[0]);

            output[key] = decodeURIComponent(parts[1]);

            return output;
        }, {});
    },
    preload: function() {
        var params = this.params();

        if (params.ids) {
            var graph = this.$.graph;
            var parse = this.parse;

            var ids = params.ids.split(/,/).filter(function(item) {
                return item;
            }).slice(0, 50).join(','); // max 50 ids

            this.fetch(ids).then(function(artists) {
                artists.forEach(function(artist) {
                    if (artist) {
                        graph.click(parse(artist));
                    }
                });
            });
        }
    },
    fetch: function(ids) {
        var resource = new Resource('https://api.spotify.com/v1/artists', {
            ids: ids
        });

        return resource.get('json').then(function(data) {
            return data.artists;
        });
    },
    search: function(name) {
        var parse = this.parse;
        var normalisedName = name.toLowerCase().trim().replace(/[^\w\s]/g, '');

        var resource = new Resource('https://api.spotify.com/v1/search', {
            type: 'artist',
            limit: 10,
            q: '"' + name + '"',
        });

        return resource.get('json').then(function(data) {
            if (!data.artists || !data.artists.items || !data.artists.items.length) {
                throw 'No matching artists found';
            }

            var nameMatches = data.artists.items.filter(function(item) {
                return item.name.toLowerCase().trim().replace(/[^\w\s]/g, '') === normalisedName;
            });

            var artist = nameMatches.length ? nameMatches[0] : data.artists.items[0];

            return parse(artist);
        });
    },
    similar: function(source) {
        var parse = this.parse;
        var resource = new Resource(source.href + '/related-artists');

        return resource.get('json').then(function(data) {
            return data.artists.map(function(artist) {
                return ({
                    source: source,
                    target: parse(artist)
                });
            });
        });
    }
});
