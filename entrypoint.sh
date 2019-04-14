#!/bin/sh

# File: entrypoint.sh                                                                    #
# Author: Rodrigue Chakode <rodrigue.chakode @ gmail dot com>                            #
#                                                                                        #
# Copyright © 2019 Rodrigue Chakode and contributors.                                    #
#                                                                                        #
# This file is part of Kubernetes Opex Analytics software.                               #
#                                                                                        #
# Kubernetes Opex Analytics is licensed under the Apache License 2.0 (the "License");    #
# you may not use this file except in compliance with the License. You may obtain        #
# a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0                   #
#                                                                                        #
# Unless required by applicable law or agreed to in writing, software distributed        #
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR            #
# CONDITIONS OF ANY KIND, either express or implied. See the License for the             #
# specific language governing permissions and limitations under the License.             #

LC_ALL='C.UTF-8' LANG='C.UTF-8' \
    python3 -u ./backend.py