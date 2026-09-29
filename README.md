# santerihukari.github.io

Personal website of Santeri Hukari.

## Local development

1. Install Ruby 3.4.9. On Windows, the RubyInstaller package named `3.4.9-1` is fine; the Ruby runtime version used by Bundler is `3.4.9`.
2. Run `bundle install` to resolve the updated Jekyll dependencies and regenerate `Gemfile.lock`.
3. Run `bundle exec jekyll serve --livereload`.
4. Open <http://127.0.0.1:4000>.

## Deployment

The site now deploys through GitHub Actions using [`.github/workflows/pages.yml`](/C:/Users/sante/OneDrive/Desktop/santerihukari.github.io/.github/workflows/pages.yml).

After pushing the workflow:

1. Open the repository's GitHub Pages settings.
2. Set the publishing source to `GitHub Actions`.
3. Keep the repository default branch as the deployment branch; the workflow only publishes from that branch.

## One-time cleanup

This repo currently contains a checked-in `_site/` build output directory from the old flow. After this migration, remove it from version control once with:

```powershell
git rm -r --cached _site
```

Then commit the result together with the new [`.gitignore`](/C:/Users/sante/OneDrive/Desktop/santerihukari.github.io/.gitignore).

## Project portfolio

Structured project and implementation records live in `_work/`. Jekyll builds
each Markdown file as `/projects/<filename>/` and the `/projects/` page lists the
collection automatically. Interactive tools, model viewers, and downloadable
asset collections remain on their own pages and are linked from the relevant
record.

Supported front-matter fields:

- `title` and `description`: project name and concise overview text.
- `kind`: broad work type, such as `project`, `implementation`, `design`,
  `infrastructure`, `prototype`, or `project-coordination`.
- `status`: current state, such as `active`, `completed`, or `experimental`.
- `order`: explicit numeric overview order. Lower numbers appear first; this
  prevents filename order from changing the page unexpectedly.
- `featured`: optional boolean used for subtle emphasis on the overview.
- `started`, `ended`, and `updated`: optional quoted strings. Use only known
  precision, for example `"2024"`, `"2026-09"`, or `"2026-09-25"`.
- `domains` and `technologies`: optional lists shown in project metadata.
- `links`: optional labeled links to a live tool, model collection,
  documentation, repository, or related page.
- `image`, `image_alt`, `image_width`, and `image_height`: optional project
  media.
- `current_state`, `outcome`, and `timeline`: optional extended status and
  milestone information.
- `cv.include` and `cv.summary`: metadata reserved for later curated CV
  integration. The CV is not generated from the collection yet.

To add a project, create `_work/descriptive-project-id.md` with front matter and
Markdown content. Treat the filename as a stable identifier. A future work-log
entry can associate itself with the same identifier, for example
`project: descriptive-project-id`, without changing the project page format.
