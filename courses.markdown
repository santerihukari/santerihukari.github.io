---
layout: page
title: Courses
permalink: /courses/
order: 5
---


<script>
async function loadCourses() {
  const res = await fetch('/courses.json'); // root of your GitHub Pages
  const courses = await res.json();

  // Example: build a set of unique tags
  const allTags = [...new Set(courses.flatMap(c => c.keywords))].sort();

  // Example: filter by selected tag
  function filterByTag(tag) {
    return courses.filter(c => c.keywords.includes(tag));
  }

  console.log('Courses:', courses);
  console.log('Available tags:', allTags);
}
loadCourses();
</script>
