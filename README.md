# Forest Admin in Nodejs (Express.js & Sequelize)

[![npm package](https://badge.fury.io/js/forest-express-sequelize.svg)](https://badge.fury.io/js/forest-express-sequelize)
[![CI status](https://github.com/ForestAdmin/forest-express-sequelize/workflows/Build,%20Test%20and%20Deploy/badge.svg?branch=master)](https://github.com/ForestAdmin/forest-express-sequelize/actions)
[![Test Coverage](https://api.codeclimate.com/v1/badges/42d6d0fce013a6b96ae2/test_coverage)](https://codeclimate.com/github/ForestAdmin/forest-express-sequelize/test_coverage)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Forest Admin provides an off-the-shelf administration panel based on a highly-extensible API plugged into your application.

This project has been designed with scalability in mind to fit requirements from small projects to mature companies.

## Who Uses Forest Admin

- [Apartmentlist](https://www.apartmentlist.com)
- [Carbon Health](https://carbonhealth.com)
- [Ebanx](https://www.ebanx.com)
- [First circle](https://www.firstcircle.ph)
- [Forest Admin](https://www.forestadmin) of course :-)
- [Heetch](https://www.heetch.com)
- [Lunchr](https://www.lunchr.co)
- [Pillow](https://www.pillow.com)
- [Qonto](https://www.qonto.eu)
- [Shadow](https://shadow.tech)
- And hundreds more…

## Getting started

[https://docs.forestadmin.com/documentation/getting-started/installation](https://docs.forestadmin.com/documentation/getting-started/installation)

## Documentation

[https://docs.forestadmin.com/documentation/](https://docs.forestadmin.com/documentation/)

## How it works

<p align="center" style="margin: 60px 0">
  <img width="100%" src="https://www.forestadmin.com/public/img/illustrations-dev/schema-1.png" alt="Howitworks">
</p>

Forest Admin consists of two components:

- The Admin Frontend is the user interface where you'll manage your data and configuration.
- The Admin Backend API hosted on your servers where you can find and extend your data models and all the business logic (routes, actions, …) related to your admin panel.

The Forest Admin NPM package (aka Forest Liana) introspects all your data model
and dynamically generates the Admin API hosted on your servers. The Forest Admin
interface is a web application that handles communication between the admin
user and your application data through the Admin API.

## Features

### CRUD

All of your CRUD operations are natively supported. The API automatically
supports your data models' validation and allows you to easily extend or
override any API routes' with your very own custom logic.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-CRUD.jpg" alt="CRUD">

### Search & Filters

Forest Admin has a built-in search allowing you to run basic queries to
retrieve your application's data. Set advanced filters based on fields and
relationships to handle complex search use cases.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Search.jpg" alt="Search and Filters">

### Sorting & Pagination

Sorting and pagination features are natively handled by the Admin API. We're
continuously optimizing how queries are run in order to display results faster
and reduce the load of your servers.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Sorting.jpg" alt="Sorting and Pagination">

### Custom action

A custom action is a button which allows you to trigger an API call to execute
a custom logic. With virtually no limitations, you can extend the way you
manipulate data and trigger actions (e.g. refund a customer, apply a coupon,
ban a user, etc.)

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Custom.jpg" alt="Sorting and Pagination">

### Export

Sometimes you need to export your data to a good old fashioned CSV. Yes, we
know this can come in handy sometimes :-)

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Export.jpg" alt="Export">

### Segments

Get in app access to a subset of your application data by doing a basic search
or typing an SQL query or implementing an API route.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Segments.jpg" alt="Segments">

### Dashboards

Forest Admin is able to tap into your actual data to chart out your metrics
using a simple UI panel, a SQL query or a custom API call.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Dashboard.jpg" alt="Dashboard">

### WYSIWYG

The WYSIWYG interface saves you a tremendous amount of frontend development
time using drag'n'drop as well as advanced widgets to build customizable views.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Wysiwyg.jpg" alt="WYSIWYG">

### Custom HTML/JS/CSS

Code your own views using JS, HTML, and CSS to display your application data in
a more appropriate way (e.g. Kanban, Map, Calendar, Gallery, etc.).

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-CustomHTML.jpg" alt="Custom views">

### Team-based permissions

Without any lines of code, manage directly from the UI who has access or can
act on which data using a team-based permission system.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Teams.jpg" alt="Team based permissions">

### Third-party integrations

Leverage data from third-party services by reconciling it with your
application’s data and providing it directly to your Admin Panel. All your
actions can be performed at the same place, bringing additional intelligence to
your Admin Panel and ensuring consistency.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-3rdParty.jpg" alt="Third-party integrations">

### Notes & Comments

Assign your teammates to specific tasks, leave a note or simply comment a
record, thereby simplifying collaboration all across your organization.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Notes.jpg" alt="Notes and Comments">

### Activity logs

Monitor each action executed and follow the trail of modification on any data
with an extensive activity log system.

<img src="https://www.forestadmin.com/public/img/illustrations-dev/screens/ForestWebsite20-Activity.jpg" alt="Activity logs">

## Community

👇 Join our Developers community for support and more

[![Discourse developers community](https://img.shields.io/discourse/posts?label=discourse&server=https%3A%2F%2Fcommunity.forestadmin.com)](https://community.forestadmin.com)
