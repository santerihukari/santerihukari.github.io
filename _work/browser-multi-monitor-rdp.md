---
title: Browser-Based Multi-Monitor RDP
description: >-
  An experimental Apache Guacamole extension that lets one Windows RDP session
  use multiple independently managed browser display windows.
kind: prototype
status: experimental
order: 55
updated: September 2026
domains:
  - Remote desktop systems
  - Web development
  - Systems integration
technologies:
  - Apache Guacamole
  - JavaScript and AngularJS
  - Java
  - C and libguac
  - FreeRDP
  - Windows RDP
  - Docker Compose
  - PostgreSQL
links:
  - label: Visit the Apache Guacamole project
    url: https://guacamole.apache.org/
---

## Purpose

An Apache Guacamole development build was extended so that one Windows remote
desktop session can behave more like a multi-monitor workspace. Each remote
display can be opened in its own browser window and managed separately instead
of treating the browser window and remote monitor as the same thing.

The prototype is private for now and will be published on GitHub as a fork when
development is complete.

## Implementation

The display manager can create, open, rename, resize, detach, reopen, and remove
remote displays. Secondary browser windows retain the names assigned to their
displays, while detaching a window no longer automatically deletes the remote
display behind it.

The implementation also includes UX/UI improvements intended to make display
management and session controls clearer and more compact.

## Demonstrated result

In a private laptop test, one Windows session used three remote displays with
different desktop areas. The displays could be resized, and applications could
be moved between them.

The browser interface is backed by Guacamole's Java web application and native
gateway rather than being a standalone frontend. The private deployment also
uses PostgreSQL, time-based one-time-password authentication, and an
access-controlled HTTPS tunnel.

## Current limitations

- The multi-monitor changes have been developed and tested for Windows RDP,
  not every protocol supported by Guacamole.
- Three displays have been demonstrated; larger arrangements are not presented
  as tested or guaranteed.
- Displays are currently arranged as one contiguous horizontal layout rather
  than arbitrary two-dimensional positions.
- Secondary display windows require browser popup support, and clipboard
  actions depend on browser permission.
- Mobile, touch, reconnect, detach/reopen, and cross-browser behavior have not
  yet been comprehensively tested.
- The system is an experimental personal deployment and has not received a
  formal accessibility or security audit.

## Attribution

This is independent work based on
[Apache Guacamole](https://guacamole.apache.org/), an Apache Software Foundation
project. It is not affiliated with or endorsed by the Apache Software
Foundation, and the underlying Guacamole code remains subject to its applicable
Apache License 2.0 and NOTICE requirements.
