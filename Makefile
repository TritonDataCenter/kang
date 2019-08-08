#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#
# Makefile: top-level Makefile
#
# This Makefile contains only repo-specific logic and uses included makefiles
# to supply common targets (javascriptlint, jsstyle, restdown, etc.), which are
# used by other repos as well.
#

#
# Tools
#
NPM		 = npm
CATEST		 = tools/catest

# javascriptlint and jsstyle should be installed in the environment
JSL		 = jsl
JSSTYLE		 = jsstyle

#
# Files
#
JS_FILES	:= $(shell find bin lib test -name '*.js')

JSL_CONF_NODE	 = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)

JSSTYLE_FILES	 = $(JS_FILES)

JSTEST_FILES	:= $(shell find test -name 'tst.*.js')

#
# Repo-specific targets
#
.PHONY: all
all:
	$(NPM) install

.PHONY: test
test:
	$(CATEST) $(JSTEST_FILES)

.PHONY: check
check: check-version

# Ensure CHANGES.md and package.json have the same version.
.PHONY: check-version
check-version:
	@echo version is: $(shell cat package.json | json version)
	[[ v`cat package.json | json version` == `grep '^## ' CHANGES.md | head -2 | tail -1 | awk '{print $$2}'` ]]

.PHONY: cutarelease
cutarelease: check-version
	[[ -z `git status --short` ]]  # If this fails, the working dir is dirty.
	@which json 2>/dev/null 1>/dev/null && \
	    ver=$(shell json -f package.json version) && \
	    echo "** Are you sure you want to tag v$$ver?" && \
	    echo "** Enter to continue, Ctrl+C to abort." && \
	    read
	ver=$(shell cat package.json | json version) && \
	    date=$(shell date -u "+%Y-%m-%d") && \
	    git tag -a "v$$ver" -m "version $$ver ($$date)" && \
	    git push origin "v$$ver"

include ./Makefile.targ
