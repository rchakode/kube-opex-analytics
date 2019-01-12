RealOpInsight oneInsight
========================

Overview
--------
RealOpInsight oneInsight, or simply oneInsight, is a visualization add-on for OpenNebula 
that allows users to have at a glance, an insight on the load of managed hosts. oneInsight 
provides various kinds of load mappings, that currently include the following metrics:
 
* CPU used by OpenNebula-managed virtual machines (VMs). 
* Memory used by managed virtual machines.
* Effective CPU used by all system processes, including processes outside 
  of managed virtual machines.
* Effective memory used by all system processes.

Here is a screenshot

![oneInsight Screenshot](images/oneinsight-screenshot-2.png)

How it Works
------------
oneInsight consists of the following components:
 
* A backend cron script to pool host information from OpenNebula periodically, 
  it relies on the OpenNebula's 
  
  
  
  
  
  
  
  
  
  
  -RPC API.  
* A Web frontend for visualizing the pooled host information. It's a fully 
  HTML/Ajax/Javascript stack built on top of modern Web libraries, such as, 
  RaphaëlJs, jQuery, and Bootstrap. A web server, like Apache and nginx, is 
  required to host the frontend.

Authors, License and Copyrights
-------------------------------
oneInsight is authored by [Rodrigue Chakode](https://github.com/rchakode/) as part of the 
[RealOpInsight Labs Project](http://realopinsight.com).


The software is licensed under the terms of Apache 2.0 License. 

Contributions and third-party libraries are properties of their respective authors.

Contributions
-------------
To contribute bug patches or new features, you can use the Github Pull Request model. 
It is assumed that code and documentation are contributed under the Apache License 2.0.

Get Started
===========
In a typical installation, oneInsight can be deployed on the OpenNebula 
server. But you're free to install it on any server from where the 
pooling script can access the OpenNebula's XML-RPC API.

Requirements
------------

**Server side**

oneInsight should work out-the-of-box on the vast majority of Linux operating systems,
subject to have the following tools installed:

  * curl command line interface
  * The Bash interpreter
  * The cron time-based job scheduler
  * A Web server like Apache and nginx, even the python SimpleHTTPServer module 
    just works fine


**Client side**

Any computer with a modern web browser should work. However, we recommend Chrome and
Firefox.

Get the Software
----------------
You can get the latest development versions of oneInsight through our Github repository: 
[http://github.com/rchakode/realopinsight-oneinsight](http://github.com/rchakode/realopinsight-oneinsight).
Release tarballs are not yet available.
 
        $ git clone git@github.com:rchakode/realopinsight-oneinsight.git

Choose Installation Directory
-----------------------------
There is no special consideration about the installation directory, but in this guide we consider
an installation in ``/opt/oneinsight``. Feel free to use another directory, subject to adapt 
the commands provided throughout the guide to your installation path.

At the end, the installation directory will have this tree:

* ``backend``: contains pooling script as well as pooled data
* ``frontend``: contains web contents
* ``index.html``: the HTML index

Copying Files
-------------

* Create the installation directory

        $ mkdir /opt/oneinsight/

* Move to the source tree

        $ cd realopinsight-oneinsight

* Copy installation files

        $ cp -r ./{index.html,backend,frontend} /opt/oneinsight/


Setting up the Pooling Script
-----------------------------
After the installation, the pooling script is located at ``/opt/oneinsight/backend/curl-xml-rpc.sh``. 
Additional configurations are required to run the script periodically via crontab: 

* Set environment variables related to the OpenNebula XML-RPC API.
  
    * ``ONE_AUTH``: should point to a file containing a valid OpenNebula user account in the form 
        of ``username:password``. In the following example we set the variable with the default 
        ``oneadmin  one_auth file``: 

              $ export ONE_AUTH=/var/lib/one/.one/one_auth

    * ``ONE_AUTH_STRING`` (optional of ONE_AUTH is set): should contain a valid user 
       account in OpenNebula. It must be set in the form of ``username:password`` as follow:

              $ export ONE_AUTH_STRING=oneadmin:password

    * ``ONE_XMLRPC``: must contain the url to the OpenNebula's XML-RPC API endpoint. If for example 
       oneInsight is being installed on the OpenNebula server you can set it as follow:
       
             $ export ONE_XMLRPC=http://localhost:2633/RPC2

* When all the environment variables are set, check that the pooling script works perfectly:

            $ bash /opt/oneinsight/backend/curl-xml-rpc.sh /opt/oneinsight/backend

     On success you should have a file named ``hostpool.xml`` created under the directory 
     ``/opt/oneinsight/backend``. This file should contain the list of OpenNebula-managed 
     hosts as returned by the XML-RPC API. Otherwise, fix all errors you may have encounter 
     before moving forward.

* Create a crontab entry to execute the polling script periodically.

    * Run the crontab editor:
   
            $ crontab -e
   
    * Then add the following line at the end of the cron list and save the changes:

            0 */5 * * * bash /opt/oneinsight/backend/curl-xml-rpc.sh /opt/oneinsight/backend
   
    * Save the change and exit the editor. The above cron entry allows to retrieve host 
      information in OpenNebula every 5 minutes, you can change the update interval if necessary.  


Setting up the Web Frontend
---------------------------
Here the pooling script must be operational. 

The oneInsight web frontend requires a working web server. Covering all the possible web 
servers is out of the scope of this guide, we'll focus on a deployment under an Apache Web 
server or using the Python SimpleHTTPServer module (for test purpose only).


**Deployment under Apache**

This should be straightforward, subject that you have a recent version of Apache and that 
all the above steps have been completed successfully:

* Copy the file ``conf/apache/oneinsight.conf`` from the source directory to the Apache 
  third-party   configuration directory:

        $ cp conf/apache/oneinsight.conf /etc/apache2/conf.d/

* Restart Apache 

        $ service apache2 restart

* Check the setup by launching a browser and go to the url of oneInsight frontend 
  ``http://<your-server>/oneinsight/``.

**Deployment under Python SimpleHTTPServer**

Python SimpleHTTPServer should be used for test purpose only, and not for production environment: 

* Go to the installation directory and run the following command

        $ cd /opt/oneinsight

* Start Python SimpleHTTPServer

        $ python -m ServerHTTPServer 8000
 
  This should start a web server serving the current directory on the port 8000. 
* Run a browser and go to the following url: ``http://your-server:8000``.



Securiry Considerations
-----------------------
oneInsight is fully Javascript/HTML based and doesn't provides any security mecanism.
However, there are options to improve the security of your deployment.

Authentication and Authorization
--------------------------------
To add authentication support when accessing the Web frontend, a simple way is to 
use the basic HTTP authentication enabled by your server. Most of modern web servers
enable this. 

Enabling authentication and authorisation with Apache involves the following steps:

* Edit the oneInsight Apache configuration located in ``/etc/apache2/conf.d/oneinsight.conf``
* Uncomment the following line

        #<Directory /opt/oneinsight>
        #  AuthBasicProvider file
        #  AuthType Basic
        #  AuthName "Access to RealOpInsight oneInsight"
        #  AuthUserFile "/opt/oneinsight/passwords"
        #  Require valid-user
        #</Directory>

* Create a user account

        $ htpasswd -c /var/oneinsight/passwords <username>

  Replace ``username`` with the desired user name. You'll be invited to set the user password.  
  The user information will be stored in the file ``/opt/oneinsight/passwords``, so you should 
  have sufficient permissions to write into the file as well into its directory (``/opt/oneinsight``).

TLS & Ciphering
---------------
It's also possible to deploy oneInsight so to it be accessible over SSL-ciphered connexions. 
To that, deploy the web frontend files so to benefit from the SSL support enabled by your Web 
server. This goes out of the scope of this quick guide, consult the documentation of your Web 
server for more details. 

