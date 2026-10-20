# frozen_string_literal: true

require "json"
require "uri"

module PublicAssets
  def self.read(site)
    file = File.join(site.source, "_data", "public_assets.json")
    return { "files" => {} } unless File.file?(file)

    manifest = JSON.parse(File.read(file))
    origin = URI(manifest.fetch("origin"))
    raise "Invalid public asset origin" unless origin.scheme == "https" && origin.host && origin.path.empty?

    manifest.fetch("files").each do |path, entry|
      raise "Invalid public asset path: #{path}" unless path.match?(%r{\Aassets/(models|stl|cad)/[a-zA-Z0-9_./-]+\z}) && !path.split("/").include?("..")
      raise "Invalid public asset hash" unless entry.fetch("sha256").match?(/\A[0-9a-f]{64}\z/)
      raise "Invalid public asset key" unless entry.fetch("key") == "v1/#{entry.fetch('sha256')}/#{File.basename(path)}"
    end
    manifest
  end

  module Filters
    def public_asset_url(input)
      site = @context.registers[:site]
      prefix = site.baseurl.to_s.sub(%r{/$}, "")
      path = input.to_s.delete_prefix(prefix + "/")
      manifest = site.config["public_asset_manifest"] || { "files" => {} }
      entry = manifest["files"][path]
      entry ? "#{manifest['origin']}/#{entry['key']}" : input
    end
  end
end

# Exclude only verified migrated files before Jekyll discovers static assets.
Jekyll::Hooks.register :site, :after_init do |site|
  manifest = PublicAssets.read(site)
  site.config["public_asset_manifest"] = manifest
  site.exclude.concat(manifest.fetch("files").keys)
end

Liquid::Template.register_filter(PublicAssets::Filters)
