'use strict';

Polymer({
    images: false,
    ready: function() {
        this.$.graph.expand = this.expand.bind(this);
        this.$.search.focus();
        this.selected = [];
        this.images = this.$.graph.clientWidth > 800;
    },
    submit: function(e) {
        e.preventDefault();
        this.$.search.blur();
        this.$.graph.reset();
        this.selected = [];
        this.search(this.artist).then(function(artist) {
            this.addSelection(artist);

            this.similar(artist).then(function(links) {
                this.$.graph.addLinks(links);
            }.bind(this));
        }.bind(this));
    },
    expand: function(source) {
        this.addSelection(source);

        return this.similar(source);
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
    select: function(artist) {
        this.selected.push({
            name: artist.name,
            id: artist.id.replace(/^spotify:artist:/, '')
        });

        if (this.selected.length > 3) {
            this.selected = this.selected.slice(-3);
        }
    },
    search: function(name) {
        var q = '"' + name + '"';
        var url = 'https://api.spotify.com/v1/search?type=artist&limit=10&q=' + encodeURIComponent(q);
        var parse = this.parse;

        return new Promise(function(respond, reject) {
            var request = new XMLHttpRequest();
            request.open('GET', url);
            request.responseType = 'json';
            request.onload = function() {
                var normalisedName = name.toLowerCase().trim().replace(/[^\w\s]/g, '');

                var data = this.response;

                if (!data.artists || !data.artists.items || !data.artists.items.length) {
                    throw 'No matching artists found';
                }

                var nameMatches = data.artists.items.filter(function(item) {
                    return item.name.toLowerCase().trim().replace(/[^\w\s]/g, '') === normalisedName;
                });

                var artist = nameMatches.length ? nameMatches[0] : data.artists.items[0];

                respond(parse(artist));
            };
            request.onerror = function() {
                reject();
            };
            request.send();
        }.bind(this));
    },
    similar: function(source) {
        var url = source.href + '/related-artists';
        var parse = this.parse;

        return new Promise(function(respond, reject) {
            var request = new XMLHttpRequest();
            request.open('GET', url);
            request.responseType = 'json';
            request.onload = function() {
                var links = this.response.artists.map(function(artist) {
                    return ({
                        source: source,
                        target: parse(artist)
                    });
                }.bind(this));

                respond(links);
            };
            request.onerror = function() {
                reject();
            };
            request.send();
        }.bind(this));
    },
});
