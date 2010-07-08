install:
	rsync -avz --exclude=.git --exclude='*~' ./ cscott.net:public_html/Projects/TurtleScript/
