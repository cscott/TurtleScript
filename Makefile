BIN=node_modules/.bin

# We use `mocha` to run tests, and `istanbul` to generate code coverage metrics
#   https://github.com/visionmedia/mocha/
#   https://github.com/gotwarlost/istanbul/
# See https://github.com/gotwarlost/istanbul/issues/23
# for the --hook-run-in-context option to istanbul that makes this work
# with requirejs, and the istanbul docs for 'istanbul test' to see how
# the --coverage option works.
test:
	npm test
cover:
	npm test --coverage

# Put a cleaned-up copy of the repo in publish/
build-publish:
	$(MAKE) README.html
	$(RM) -rf publish
	mkdir publish
	git archive --format=tar --prefix=publish/ HEAD | tar -x
	# clean up
	$(RM) publish/README.rst publish/.gitignore publish/Makefile
	$(RM) -r publish/bin publish/test
	cp README.html publish/index.html
	# domain name for github pages
	echo turtlescript.github.cscott.net > publish/CNAME
	# turn off jekyll for github pages
	touch publish/.nojekyll
	# make docco
	$(BIN)/docco -o publish/docco publish/*.js

# Publish the cleaned up repo from publish/ to various places on the
# internet, as well as github's gh-pages.
install: build-publish
	rsync -avz --exclude=.git --exclude='*~' publish/ cscott.net:public_html/Projects/TurtleScript/
	#rsync -avz --exclude=.git --exclude='*~' publish/ dev.laptop.org:public_html/TurtleScript/
	$(RM) -rf clean
	git clone --reference . -b gh-pages git@github.com:cscott/TurtleScript.git clean
	cd clean && git rm -rf .
	cp -r publish/* publish/.[a-z]* clean/
	cd clean && git add . && git commit -m "Updated `date`" && \
		git push origin gh-pages

# Convert the ReStructured Text README into html.
README.html: README.rst
	rst2html $< $@

# slurp all the turtlescript code together to make a single file for
# benchmarking.
make-benchmark:
	$(BIN)/r.js -o name=tests out=benchmark/3rdParty/turtlescript.js baseUrl=. optimize=none paths.timeouts=empty:
