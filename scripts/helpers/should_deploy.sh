#!/bin/bash

git diff --quiet HEAD^ HEAD ./ ':(exclude)README.md'
