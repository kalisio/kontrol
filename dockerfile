FROM node:12.16-buster-slim
LABEL maintainer "<contact@kalisio.xyz>"

EXPOSE 8080

ENV HOME /kontrol
RUN mkdir ${HOME}

COPY . ${HOME}

WORKDIR ${HOME}

RUN yarn

CMD npm run start