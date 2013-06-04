
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
	node_modules/docco/bin/docco -o publish/docco publish/*.js

install: build-publish
	rsync -avz --exclude=.git --exclude='*~' publish/ cscott.net:public_html/Projects/TurtleScript/
	rsync -avz --exclude=.git --exclude='*~' publish/ dev.laptop.org:public_html/TurtleScript/
	$(RM) -rf clean
	git clone -b gh-pages https://github.com/cscott/TurtleScript.git clean
	cd clean && git rm -rf .
	cp -r publish/* publish/.[a-z]* clean/
	cd clean && git add . && git commit -m "Updated `date`" && \
		git push origin gh-pages

README.html: README.rst
	rst2html $< $@
