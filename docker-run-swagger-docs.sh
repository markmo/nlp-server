#!/usr/bin/env bash
docker run -p 49141:8080 -e API_URL=http://aiplatform.host/nlp-server/api-docs.json -d swaggerapi/swagger-ui
