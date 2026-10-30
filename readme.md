### Steps
1. coded the server.js and server.test.js
2. Dockerized the mini api server
3. compose with app and posgresdb
4. constructed ci.yml with all required stages of testing the app and simple deploy commands
5. setup self-hosted runner
6. added rollback option by using deploy.sh script that checks on deploy if app is healthy, if not then deploy stored previous version
7. updated ci.yml simultanuosly to use the deploy script instead of direct compose commands
8. setup prometheus service
9. setup alertmanager service to send smtp to me


### Secrets

All required Secrets are added to github secrets

### AI Disclosure

AI (Cluade and Gemini were used alternetly depending on case) was used to build app servers and jest test, deploy script, unfamiliar errors and act as reviewer to my work (workflow, Dockerfile, Docker Compose, services yml configurations) on other parts to ensure high performance & quality implementation.

The choice of approach and steps and tools is mine


### References
0. https://docs.github.com/en/actions/get-started/quickstart
1. https://medium.com/@vincenthartmann/how-to-add-a-security-scan-with-trivy-in-github-actions-8f16642aa82b
2- https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
3- https://stackoverflow.com/questions/59073731/set-default-timeout-on-github-action-pipeline
4- https://docs.docker.com/engine/daemon/prometheus/
5- https://medium.com/javarevisited/monitoring-setup-with-docker-compose-part-3-alertmanager-5d0a2d4a5612
6- https://stackoverflow.com/questions/63557145/alertmanager-not-able-send-mails-via-port-465