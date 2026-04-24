.PHONY: setup dev build deploy restart logs clean clean-volumes ps health

setup:
	sh scripts/project.sh setup

dev:
	sh scripts/project.sh dev

build:
	sh scripts/project.sh build

deploy:
	sh scripts/project.sh deploy

restart:
	sh scripts/project.sh restart

logs:
	sh scripts/project.sh logs

clean:
	sh scripts/project.sh clean

clean-volumes:
	sh scripts/project.sh clean-volumes

ps:
	sh scripts/project.sh ps

health:
	sh scripts/project.sh health
