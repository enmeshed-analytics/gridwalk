DATE := $(shell date +%Y-%m-%d)

COMMIT_TYPES := feat fix docs style refactor perf test build ci chore revert

repo-update: git-add git-commit git-push

git-add:
	git add .

git-commit:
	@echo "Available commit types: $(COMMIT_TYPES)"
	@read -p "Enter commit type: " type; \
	if echo "$(COMMIT_TYPES)" | grep -wq "$$type"; then \
		read -p "Enter commit scope (optional, press enter to skip): " scope; \
		read -p "Enter commit message: " msg; \
		if [ -n "$$scope" ]; then \
			git commit -m "$$type($$scope): $$msg [$(DATE)]"; \
		else \
			git commit -m "$$type: $$msg [$(DATE)]"; \
		fi; \
	else \
		echo "Invalid commit type. Please use one of the available types."; \
		exit 1; \
	fi

git-push:
	git push
