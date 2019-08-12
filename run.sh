#!/bin/bash

if [[ ! -f ~/.jupyter/jupyter_notebook_config.json ]] || ! grep -q "password" ~/.jupyter/jupyter_notebook_config.json; then
    echo -- Enter a Jupyter Notebook password --
    jupyter notebook password
    echo
fi

ip=$(ipconfig getifaddr en0)
port=8888
echo -- Starting Jupyter Notebook server at $ip:$port --
jupyter notebook --ip $ip --port $port
