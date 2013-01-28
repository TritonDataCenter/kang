# kang: distributed system observability

Kang is a facility for debugging networked software services by exposing
internal state via a simple HTTP API.  Service state is organized into a
two-level hierarchy of "objects" organized by "type".  For example, a simple
HTTP server may have two types of objects: "requests" and "connections", and
there may be many objects of each type.  Each server defines its own types and
the structures of its objects.

## Demo

First, install the command-line tool:

    # npm install -g kang

Then run the example server in this repo:

    # node examples/server.js
    server listening at http://0.0.0.0:8080

Now run the kang debugger:

    # kang -hlocalhost:8080

Run "help" for some suggested examples and try them out.


## kang tool

Usage: `kang [-h host1[host2...]]`

Remote servers are specified using the following format:

    [http[s]://]host[:port][/uri]

All fields other than the host are optional.  Nearly any combination may be
specified, as in:

      REMOTE HOST              MEANS
      localhost                http://localhost:80/status/snapshot
      localhost:8080           http://localhost:8080/status/snapshot
      localhost:8080/kang      http://localhost:8080/kang
      https://localhost/kang   https://localhost:443/kang

Multiple servers may be specified in a comma-separated list.  Servers are
specified using the -h option or (if none is present) the KANG\_SOURCES
environment variable.

When you run `kang`, it creates a snapshot of the distributed system's state by
querying each of the servers.  You can browse the state interactively.  Type
"help" for more information.

## Background

While interactive program execution is a useful feature during development, the
most important feature for debuggers in both development and production
environments is the presentation of current program state.  Program state is
often examined on an ad-hoc basis by engineers debugging a particular problem,
but it's often useful to build tools to automatically analyze this state as
well, either to summarize it for humans or to automatically look for certain
classes of problems.  In this regard, kang is a debugger for distributed
systems: it fetches, aggregates, and presents program state for consumption by
both humans and automated tools.  The goal is to allow each component of the
distributed system to describe the objects it knows about (and potentially a
small amount of metadata suggesting what to do with this information) so that
the kang system can fetch, aggregate, and present this information usefully.

In debugging distributed systems of heterogeneous components, it's critical to
be able to quickly understand the internal state of each component. We have
[https://github.com/trentm/node-bunyan](logs) and
[https://github.com/joyent/node-panic](dumps) to understand explicit errors and
fatal failures, but you need more to understand why a service is simply
behaving wrong.

Most of the time, the internal state takes the form of just a few important
types of objects. It would be really useful if each service provided a standard
way of extracting this state for the purpose of debugging.

## API

kang defines a single HTTP entry point, `/kang/snapshot`, that returns a
snapshot of the service's internal state in the form of a JSON object that
looks like this:

    {
            /* service identification information */
            "service": {
                    "name": "ca",
                    "component": "configsvc",
                    "ident": "us-sw-1.headnode",
                    "version": "0.1.0vmaster-20120126-2-g92bf718"
            },

            /* arbitrary service stats */
            "stats": {
                    "started": "2012-03-20T17:03:59.221Z",
                    "uptime": 86403217,
                    "memory": {
                            "rss": 10850304,
                            "heaptotal": 2665280,
                            "heapused": 1700788
                    },
                    "http": {
                        "nrequests": 1709,
                        "nrequestsbycode": {
                          "200": 1705,
                          "201": 1,
                          "204": 1,
                          "503": 1
                        }
                    }
            },

            /* extra service-specific information */
            "types": [ 'instrumentation', 'instrumenter' ],

            "instrumentation": {
                    "cust:12345;1": {
			    "creation_time": "2012-01-26t19:20:30.450z",
			    "label": "12345/1"
                            "module": "node",
                            "stat": "httpd_ops",
                            "decomposition": "latency",
                            "granularity": 1,
                            "instrumenters": {
                                    "instrumenter:instr1": "enabled",
                                    "instrumenter:instr2": "enabled",
                                    "instrumenter:instr3": "disabled"
                            }
                    }
            },

            "instrumenter": {
                    "instr1": {
                            "creation_time": "2012-01-26t19:20:30.450z",
                            "instrumentations": [ "instrumentation:cust:12345;1" ],
                            "last_contact": "2012-01-26t19:20:30.450z"
                    },
                    "instr2": {
                            "creation_time": "2012-01-26t19:20:30.450z",
                            "instrumentations": [ "instrumentation:cust:12345;1" ],
                            "last_contact": "2012-01-26t19:20:30.450z"
                    },
                    "instr3": {
                            "creation_time": "2012-01-26t19:20:30.450z",
                            "instrumentations": [ ],
                            "last_contact": "2012-01-10t19:20:30.450z"
                    }
            }
    }

Note that many of the above field names match the corresponding fields used in
Bunyan for logging.  Clients can link objects reported by multiple components
(or even services) by assuming any given (type, id) tuple is unique.  Clients
can also link any string of the form "type:id" (for a known object type and id)
to the corresponding object.  For example, the "instrumenter:instr1" key in the
instrumentation above can be linked directly to that object.

In the future we may define semantics for some fields like "label", and
"creation\_time" so that the tools can present this information more usefully.

## Server library

kang includes a server library for implementing the above API.  Any project that
wants to take advantage need only implement a few entry points:

* report service identification information
* report stats
* list object types
* list objects for a given type
* serialize one object

Services can add information incrementally as desired.  The library takes care
of formatting this data appropriately.

## Client library

kang includes a client library for listing and browsing objects from a set of
services.  See cmd/kang.js for example usage.

## CLI

See above for details.

## Future work

- Remove prefixes on library function names
