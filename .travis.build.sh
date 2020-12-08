#!/bin/bash
source .travis.env.sh

echo Building Kontrol $TAG

docker build -t kalisio/kontrol:$TAG .

docker login -u="$DOCKER_USER" -p="$DOCKER_PASSWORD"
docker push kalisio/kontrol:$TAG
