---
layout: post
title:  "Add strava social icon to Jekyll theme minima"
date:   2021-07-21
published: true
---

Inner workings of footer-component
===================
The file footer.html includes the more specific layout of the footer, in where the social icons are shown. It is found under the path `_layouts/`.

The file refers to another file: `_layouts/social.html`.

All `social.html` includes is a `<ul>` html-element, which checks the `_config.yml` for personal information for certain platforms. The page will then show a list with an icon (which links to the user profile on the platform) for each platform with configured information in the `_config.yml`.

{% highlight ruby %}
  minima:
    date_format: "%b %-d, %Y"
    social_links:
      github: santerihukari
      linkedin: santerihukari
      strava: "33399886"
      telegram: santerihukari
      instagram: santerihukari
{% endhighlight %}

As seen in the clip above from my `_config.yml`, I've defined my strava user-id along with username on other platforms. Strava uses user-id instead of username in the url, which is why an username isn't used.


Creating the icon coherent with the minima theme.
=========================
First a suitable logo should be found. Here I simply googled strava, and took the first square logo which seemed to fit in. The only problem was that the color was wrong.

I downloaded the logo in png-format, transformed it to grayscale using [lunapic](https://www11.lunapic.com/editor/?action=twotone) for easier handling with [pngtosvg](pngtosvg.com), which can be used to reduce the amount of colors used in an image, and then transform to svg. Lastly, I used [vectorpaint](https://vectorpaint.yaks.co.nz/) to fine-tune the color code of the logo according to the one found in included in minima theme icons. The color code was figured out using [html-color-codes.info](https://html-color-codes.info/colors-from-image/). It is possible that there are tools available which would make this easier, photoshop for one.

Since svg is based on vector graphics, a logo can be expressed with a snip of code, which is greatly used by minima; there is a specific file called `assets/minima-social-icons.svg`, which contains the code needed for the icons. So no extra files are necessary to be added. Simply adding the svg-code of the logo in the file `assets/minima-social-icons.svg` is enough. Below you can see the code snippet used to generate strava-logo.

{% highlight HTML %}
<symbol id="strava">
  <rect id="backgroundrect" width="100%" height="100%" x="0" y="0" fill="none" stroke="none"/>
  <g class="currentLayer" style=""><title>Layer 1</title>
    <path d="M0,0 h16 v16 H0 z" fill="#828282" id="svg_1" class="selected" fill-opacity="1"/>
    <g fill="#ffffff" fill-rule="evenodd" id="svg_2" class="" fill-opacity="1">
      <path d="M6.9 8.8l2.5 4.5 2.4-4.5h-1.5l-.9 1.7-1-1.7z" opacity=".6" id="svg_3" fill="#ffffff" fill-opacity="1"/>
      <path d="M7.2 2.5l3.1 6.3H4zm0 3.8l1.2 2.5H5.9z" id="svg_4" fill="#ffffff" fill-opacity="1"/>
    </g>
  </g>
</symbol>
{% endhighlight %}

The code above could possibly be shortened a lot, but it works as is, and looks good, so there is no need to change it for this project.

{% highlight markdown %}
{% raw %}
{%- if social.strava -%}<li><a href="https://www.strava.com/athletes/{{ social.strava | cgi_escape | escape }}" title="{{ social.strava | escape }}"><svg class="svg-icon grey"><use xlink:href="{{ '/assets/minima-social-icons.svg#strava' | relative_url }}"></use></svg></a></li>{%- endif -%}
{% endraw %}
{% endhighlight %}
