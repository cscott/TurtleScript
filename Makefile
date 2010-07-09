install:
	$(MAKE) README.html
	ln -sf README.html index.html
	rsync -avz --exclude=.git --exclude='*~' ./ cscott.net:public_html/Projects/TurtleScript/

README.html: README.rst
	rst2html $< $@
