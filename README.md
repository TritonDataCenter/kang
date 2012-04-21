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

Now use kang to query available types:

    # kang -hlocalhost:8080 type
    TYPE    
    service 
    stats   
    student 
    teacher 
    staff 

Or query specific types of objects:

    # kang -hlocalhost:8080 -l student
    STUDENT ROLE  SURNAME 
    bart    clown simpson 
    lisa    geek  simpson 
    nelson  bully muntz   


## kang tool

Usage: kang [-h host1[host2...]] [-l] [-o col1[,col2...] query
       kang [-h host1[host2...]] -f "json" query

Queries remote Kang servers for objects matching "query" and prints out the
results.  The following options are supported:

    -f     output format (default: human-readable text)
    -h     remote Kang hosts, as comma-separated list of
           [http[s]]://host[:port][/uri]
    -l     long listing (emit object details, not just identifiers)
    -o     column names to print, as comma-separated list (implies -l)

"query" is an object type or identifier, as in:

    client             all objects of type "client"
    client:localhost   all objects of type "client" with id "localhost"

The special query "type" lists all available types.

In the first form, this tool prints results in human-readable form.  The
following options are supported:

For text-based output, the following options are supported:

    -l             Long listing.  Emit object details, not just the
                   object\'s identifier

    -o col1,...    Emit only the given fields of each object. Implies -l.

The -f option allows other output formats to be specified.  The only
other format currently supported is json.

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
specified using the -h option or (if none is present) the KANG_SOURCES
environment variable.

## Background

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

kang defines a single HTTP entry point, `/status/snasphot`, that returns a
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

One-shot mode:

    # kang -h 10.99.99.20 type
    TYPE
    service
    stats
    instrumentation
    instrumenter

    # kang -h 10.99.99.20 instrumenter
    INSTRUMENTER
    instr1
    instr2
    instr3

    # kang -h 10.99.99.20 instrumenter:instr1
    [ {
        "instrumenter": "instr1",
    	"creation_time": "2012-01-26t19:20:30.450z",
    	"instrumentations": [],
    	"last_contact": "2012-01-26t19:20:30.450z"
    } ]

Aggregating from multiple services, and using an environment variable to avoid
having to specify the services each time:

    # export KANG_HOSTS=10.99.99.20,10.99.99.21:8080
    # kang -l service
    SERVICE        IDENT      NAME  VERSION
    ca.localhost   localhost  ca    0.0.1
    amon.localhost localhost  amon  0.1.0

    # kang type
    TYPE
    instrumentation
    instrumenter
    monitor

## Future work

- Cached mode for reading a snapshot from a given file for high-latency links
  and postmortem analysis.
- Webconsole: turn on/off (and reorder?) individual table columns
  Webconsole: refactor snapshot parsing to share code for web and server
- Remove prefixes on library function names
- Make default path /kang/snapshot
