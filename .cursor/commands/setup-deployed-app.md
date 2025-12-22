# setup-deployed-app

I will give you a name for a Heroku app that exists.

You do this, replacing <app-name> with the name of the app I gave you:

```bash
cd ~/code
heroku git:clone -a <app-name>
cd <app-name>
git remote add upstream git@github.com:aagnone-sfhk/agentforce-ui.git
git pull --rebase upstream main
code <app-name> -r
```
