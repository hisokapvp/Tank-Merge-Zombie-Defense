/**
 * Lesson Catalog (Pack 3).
 * Provides metadata for all lessons and helper accessors.
 */
(function (global) {
  'use strict';

  var LESSONS = [
    {
      id: 'basics_merge_tanks',
      name: 'Basics: Merge Tanks',
      summary: 'Learn the core merge flow and upgrade basics.',
      tags: ['basics', 'merge'],
      thumbnail: ''
    },
    {
      id: 'combat_fire_patterns',
      name: 'Combat: Fire Patterns',
      summary: 'Understand firing arcs, rates, and targeting.',
      tags: ['combat', 'fire'],
      thumbnail: ''
    },
    {
      id: 'economy_coin_strategy',
      name: 'Economy: Coin Strategy',
      summary: 'Balance spending and upgrades to scale faster.',
      tags: ['economy', 'coins'],
      thumbnail: ''
    },
    {
      id: 'defense_zombie_waves',
      name: 'Defense: Zombie Waves',
      summary: 'Prepare for wave pressure and positioning.',
      tags: ['defense', 'zombies'],
      thumbnail: ''
    },
    {
      id: 'advanced_multi_barrel',
      name: 'Advanced: Multi-Barrel',
      summary: 'Master multi-barrel tanks and damage splits.',
      tags: ['advanced', 'combat'],
      thumbnail: ''
    }
  ];

  function cloneLesson(lesson) {
    return {
      id: lesson.id,
      name: lesson.name,
      summary: lesson.summary,
      tags: lesson.tags ? lesson.tags.slice() : [],
      thumbnail: lesson.thumbnail || ''
    };
  }

  function listLessons() {
    var out = [];
    for (var i = 0; i < LESSONS.length; i++) {
      out.push(cloneLesson(LESSONS[i]));
    }
    return out;
  }

  function getLessonById(id) {
    if (!id) return null;
    for (var i = 0; i < LESSONS.length; i++) {
      if (LESSONS[i].id === id) return cloneLesson(LESSONS[i]);
    }
    return null;
  }

  global.Game = global.Game || {};
  global.Game.LessonCatalog = {
    listLessons: listLessons,
    getLessonById: getLessonById,
    _LESSONS: LESSONS
  };
})(typeof window !== 'undefined' ? window : this);
