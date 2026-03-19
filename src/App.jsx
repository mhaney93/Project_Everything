// ...existing code...
import { useMobileHeaderSpacer } from './mobileHeaderSpacer';
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { authAPI, mapsAPI, filesAPI, API_BASE_URL } from './api';

// Node size and layout constants
const NODE_SIZE_MIN = 0.6;
const NODE_SIZE_MAX = 2.0;
const NODE_SIZE_STEP = 0.1;

// Node layout and spacing constants
const NODE_WIDTH = 176;
const NODE_HEIGHT = 52;
const H_GAP = 5;
const V_GAP = 45;
const PADDING = 90;

// Default initial nodes for the knowledge map
const INITIAL_NODES = [
  {
    id: 1,
    label: 'Everything',
    parentId: null,
    hidden: false,
    summary: 'The root of all knowledge',
  },
];


// v2: Humanities integration complete



// Password rule checking utility for login/signup forms
function getPasswordRuleChecks(password) {
  // Example rules: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  return [
    {
      label: 'At least 8 characters',
      met: typeof password === 'string' && password.length >= 8,
    },
    {
      label: 'Contains a lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      label: 'Contains an uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      label: 'Contains a number',
      met: /[0-9]/.test(password),
    },
    {
      label: 'Contains a special character',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

// ...other code...

// AddChildren function (example signature, update as needed)
async function addChildren({ existingPredefined, parentNodeId, parent, updatedNodes, nextId, enableAnimations, setAnimatingIds, setNodes, setBasePanOffset, setRecenterKey, setSelectedId, lastFocusedIdRef, setForceRecenter, getChildSuggestions, generateSummary, layout }) {
  // After updating nodes, always find the leftmost visible child for centering
  const getLeftmostChildId = (allNodes, parentId) => {
    // Only consider visible (not hidden) children
    const visibleChildren = allNodes.filter((node) => node.parentId === parentId && !node.hidden);
    if (visibleChildren.length === 0) return null;
    // Use layout.positions to get x positions
    // If layout is not available yet, fallback to first in array
    if (typeof layout?.positions?.get === 'function') {
      let leftmost = visibleChildren[0];
      let minX = Infinity;
      for (const child of visibleChildren) {
        const pos = layout.positions.get(child.id);
        if (pos && pos.x < minX) {
          minX = pos.x;
          leftmost = child;
        }
      }
      return leftmost.id;
    }
    return visibleChildren[0].id;
  };

  if (existingPredefined.length === 0) {
    let labels = ['Concept A', 'Concept B'];
    if (parentNodeId === 1) {
      labels = ['Humanities', 'Sciences'];
    } else {
      labels = await getChildSuggestions(parent.label);
    }

    const maxExistingId = updatedNodes.reduce((maxId, node) => {
      if (!node || !Number.isFinite(node.id)) return maxId;
      return Math.max(maxId, node.id);
    }, 0);
    const startId = Math.max(nextId.current, maxExistingId + 1);

    const newNodeIds = Array.from({ length: labels.length }, (_, i) => startId + i);
    const newNodes = Array.from({ length: labels.length }, (_, index) => ({
      id: startId + index,
      label: labels[index],
      parentId: parentNodeId,
      hidden: false,
      summary: generateSummary(labels[index]),
    }));

    nextId.current = startId + newNodes.length;

    if (enableAnimations) {
      setAnimatingIds(new Set(newNodeIds));
      updatedNodes = [...updatedNodes, ...newNodes];
      setNodes(updatedNodes);
      requestAnimationFrame(() => setAnimatingIds(new Set()));
    } else {
      updatedNodes = [...updatedNodes, ...newNodes];
      setNodes(updatedNodes);
    }
    setBasePanOffset({ x: 0, y: 0 });
    setRecenterKey((k) => k + 1);
    // After state updates, use setTimeout to get the leftmost child from the new layout
    setTimeout(() => {
      const leftmostId = getLeftmostChildId(updatedNodes, parentNodeId);
      if (leftmostId) {
        setSelectedId(null);
        lastFocusedIdRef.current = leftmostId;
        setForceRecenter(true);
        setTimeout(() => setForceRecenter(false), 100);
      }
    }, 0);
  } else {
    setNodes(updatedNodes);
    setBasePanOffset({ x: 0, y: 0 });
    setRecenterKey((k) => k + 1);
    setTimeout(() => {
      const leftmostId = getLeftmostChildId(updatedNodes, parentNodeId);
      if (leftmostId) {
        setSelectedId(null);
        lastFocusedIdRef.current = leftmostId;
        setForceRecenter(true);
        setTimeout(() => setForceRecenter(false), 100);
      }
    }, 0);
  }

  // Return the leftmost child id for consistency
  const leftmostChildId = getLeftmostChildId(updatedNodes, parentNodeId);
  return { expanded: true, firstChildId: leftmostChildId };
}

const LABEL_MIGRATIONS_BY_VERSION = {
  1: {
    Art: 'Arts',
  },
  2: {
    '3.3 million years ago - 3,200 BC Prehistory': 'Prehistory (3.3 million years ago - 3,200 BC)',
    '3,200 BC - 476 AD Ancient History': 'Ancient History (3,200 BC - 476 AD)',
    '476 - 1453 Medieval Period': 'Medieval Period (476 - 1453)',
    '1453 - present Modern Era': 'Modern Era (1453 - present)',
    '3.3 million years ago - 3,300 BC Stone Age': 'Stone Age (3.3 million years ago - 3,300 BC)',
    '3,300 BC - 3,200 BC Early Bronze Age (Prehistoric)': 'Early Bronze Age (3,300 BC - 3,200 BC)',
    '3.3 million years ago - 10,000 BC Paleolithic Era': 'Paleolithic Era (3.3 million years ago - 10,000 BC)',
    '10,000 BC - 8,000 BC Mesolithic Era': 'Mesolithic Era (10,000 BC - 8,000 BC)',
    '8,000 BC - 4,500 BC Neolithic Era': 'Neolithic Era (8,000 BC - 4,500 BC)',
    '4,500 BC - 3,300 BC Copper Age': 'Copper Age (4,500 BC - 3,300 BC)',
    '3.3 million years ago - 300,000 years ago Lower Paleolithic': 'Lower Paleolithic (3.3 million years ago - 300,000 years ago)',
    '300,000 years ago - 40,000 years ago Middle Paleolithic': 'Middle Paleolithic (300,000 years ago - 40,000 years ago)',
    '40,000 years ago - 10,000 BC Upper Paleolithic': 'Upper Paleolithic (40,000 years ago - 10,000 BC)',
    '300,000 years ago - 120,000 years ago Early Middle Paleolithic': 'Early Middle Paleolithic (300,000 years ago - 120,000 years ago)',
    '120,000 years ago - 40,000 years ago Last Glacial Period (Middle Paleolithic)': 'Last Glacial Period, Middle Paleolithic (120,000 years ago - 40,000 years ago)',
    '40,000 years ago - 10,000 BC Last Glacial Period (Upper Paleolithic)': 'Last Glacial Period, Upper Paleolithic (40,000 years ago - 10,000 BC)',
    '10,875 BC - 10,000 BC Younger Dryas Event (Upper Paleolithic)': 'Younger Dryas Event, Upper Paleolithic (10,875 BC - 10,000 BC)',
    '10,000 BC - 9,675 BC Last Glacial Period End (Mesolithic)': 'Last Glacial Period End, Mesolithic (10,000 BC - 9,675 BC)',
    '10,000 BC - 9,675 BC Younger Dryas Event (Mesolithic)': 'Younger Dryas Event, Mesolithic (10,000 BC - 9,675 BC)',
    '9,675 BC - 9,575 BC Younger Dryas End (Late Mesolithic)': 'Younger Dryas End, Late Mesolithic (9,675 BC - 9,575 BC)',
    '9,675 BC - 8,000 BC Late Mesolithic': 'Late Mesolithic (9,675 BC - 8,000 BC)',
    '4,100 BC - 3,300 BC Sumerian Civilization (Copper Age)': 'Sumerian Civilization (4,100 BC - 3,300 BC)',
    '4,100 BC - 3,300 BC Uruk Period': 'Uruk Period (4,100 BC - 3,300 BC)',
    '4,100 BC - 3,300 BC Predynastic Egypt (Copper Age)': 'Predynastic Egypt (4,100 BC - 3,300 BC)',
    '3,500 BC - 3,300 BC Ebla Civilization (Copper Age)': 'Ebla Civilization (3,500 BC - 3,300 BC)',
    '3,300 BC - 3,200 BC Indus Valley Civilization (Prehistoric)': 'Indus Valley Civilization (3,300 BC - 3,200 BC)',
    '3,300 BC - 3,200 BC Cycladic Civilization (Prehistoric)': 'Cycladic Civilization (3,300 BC - 3,200 BC)',
    '3,200 BC - 1,200 BC Bronze Age (Ancient)': 'Bronze Age (3,200 BC - 1,200 BC)',
    '1,200 BC - 600 BC Iron Age': 'Iron Age (1,200 BC - 600 BC)',
    '3,100 BC - 30 BC Ancient Egypt': 'Ancient Egypt (3,100 BC - 30 BC)',
    '3,500 BC - 539 BC Ancient Mesopotamia': 'Ancient Mesopotamia (3,500 BC - 539 BC)',
    '3,300 BC - 600 AD Ancient India': 'Ancient India (3,300 BC - 600 AD)',
    '2,070 BC - 220 AD Ancient China': 'Ancient China (2,070 BC - 220 AD)',
    '800 BC - 146 BC Ancient Greece': 'Ancient Greece (800 BC - 146 BC)',
    '753 BC - 476 AD Ancient Rome': 'Ancient Rome (753 BC - 476 AD)',
    '476 - 1000 Early Middle Ages': 'Early Middle Ages (476 - 1000)',
    '1000 - 1250 High Middle Ages': 'High Middle Ages (1000 - 1250)',
    '1250 - 1453 Late Middle Ages': 'Late Middle Ages (1250 - 1453)',
    '330 - 1453 Byzantine Empire': 'Byzantine Empire (330 - 1453)',
    '750 - 1258 Islamic Golden Age': 'Islamic Golden Age (750 - 1258)',
    '1453 - 1789 Early Modern Period': 'Early Modern Period (1453 - 1789)',
    '1789 - 1945 Late Modern Period': 'Late Modern Period (1789 - 1945)',
    '1945 - present Contemporary Period': 'Contemporary Period (1945 - present)',
    '1300 - 1600 Renaissance': 'Renaissance (1300 - 1600)',
    '1400 - 1800 Age of Discovery': 'Age of Discovery (1400 - 1800)',
    '1517 - 1648 Reformation': 'Reformation (1517 - 1648)',
    '1637 - 1800 Enlightenment': 'Enlightenment (1637 - 1800)',
    '1543 - 1687 Scientific Revolution': 'Scientific Revolution (1543 - 1687)',
    '1760 - 1840 Industrial Revolution': 'Industrial Revolution (1760 - 1840)',
    '1774 - 1849 Age of Revolutions': 'Age of Revolutions (1774 - 1849)',
    '1800 - 1945 Imperialism': 'Imperialism (1800 - 1945)',
    '1914 - 1918 World War I': 'World War I (1914 - 1918)',
    '1918 - 1939 Interwar Period': 'Interwar Period (1918 - 1939)',
    '1939 - 1945 World War II': 'World War II (1939 - 1945)',
    'Ethics': 'Ethics/Moral Philosophy',
    'Gettier Problem': 'The Gettier Problem',
    'Virtue Ethics': 'Aristotle\'s Virtue Ethics',
    'Deontology': 'Kant\'s Deontology',
    'Alternate Theory: Israel Killed Kennedy': 'Alternate Theories',
    'Ockham\'s Radical Nominalism': 'Ockham\'s Conceptualism',
    'Free Will': 'Free Will vs. Determinism',
    '1947 - 1991 Cold War': 'Cold War Era (1947 - 1991)',
    'Cold War (1947 - 1991)': 'Cold War Era (1947 - 1991)',
    '1991 - 2001 Post-Cold War Era': 'Post-Cold War Era (1991 - 2001)',
    '2001 - present 21st Century': '21st Century (2001 - present)',
  },
};

// Parents whose children should use TOPIC_SUBDIVISIONS defined order (e.g., chronological)
// All other parents will be alphabetized by default
const ORDERED_CHILDREN_PARENTS = new Set([
  'History',
  'Prehistory (3.3 million years ago - 3,200 BC)',
  'Stone Age (3.3 million years ago - 3,300 BC)',
  'Paleolithic Era (3.3 million years ago - 10,000 BC)',
  'Middle Paleolithic (300,000 years ago - 40,000 years ago)',
  'Upper Paleolithic (40,000 years ago - 10,000 BC)',
  'Mesolithic Era (10,000 BC - 8,000 BC)',
  'Last Glacial Period End, Mesolithic (10,000 BC - 9,675 BC)',
  'Copper Age (4,500 BC - 3,300 BC)',
  'Sumerian Civilization (4,100 BC - 3,300 BC)',
  'Early Bronze Age (3,300 BC - 3,200 BC)',
  'Ancient History (3,200 BC - 476 AD)',
  'Bronze Age (3,200 BC - 1,200 BC)',
  'Early Bronze Age (3,200 BC - 2,000 BC)',
  'Iron Age (1,200 BC - 600 BC)',
  'Early Iron Age (1,200 BC - 1,000 BC)',
  'Late Antiquity (250 - 500 AD)',
  'Early Middle Ages (476 - 1000)',
  'Late Antiquity (500 - 750)',
  'High Middle Ages (1000 - 1250)',
  'Medieval Period (476 - 1453)',
  'Modern Era (1453 - present)',
  'Early Modern Period (1453 - 1789)',
  'Late Modern Period (1789 - 1945)',
  'Industrial Revolution (1760 - 1840)',
  'Italy (1800 - 1945)',
  'Middle East Conflict (1882 - 1945)',
  'Aliyahs (1882 - 1948)',
  'World Wars Era (1914 - 1945)',
  'World War I (1914 - 1918)',
  'Interwar Period (1918 - 1939)',
  'Germany in the Interwar Period (1919 - 1939)',
  'World War II (1939 - 1945)',
  'America in World War II (1941 - 1945)',
  'European Theater (1939 - 1945)',
  'Pacific Theater (1941 - 1945)',
  'End of World War II (1945)',
  'Jewish Insurgency in Mandatory Palestine (1944 - 1948)',
  'Lehi (1940 - 1948)',
  'Contemporary Period (1945 - present)',
  'Post-World War II Era (1945 - 1947)',
  'Cold War Era (1947 - 1991)',
  'USSR during the Cold War (1947 - 1991)',
  'America during the Cold War Era (1947 - 1991)',
  "American Concerns over Israel's Nuclear Program (1960 - 1991)",
  'JFK Presidency (1961 - 1963)',
  'Assassination of President John F. Kennedy (1963)',
  'Lee Harvey Oswald (1939 - 1963)',
  'Two Germanys (1949 - 1990)',
  'Space Race (1957 - 1975)',
  'Vietnam War (1955 - 1975)',
  'Cuban Missile Crisis (1962)',
  'Middle East Conflict (1945 - present)',
  'Aliyahs (1945 - present)',
  'Jewish Insurgency (1945 - 1948)',
  'Civil War in Mandatory Palestine (1947 - 1948)',
  '1948 Arab-Israeli War (1948 - 1949)',
  'Israeli Military Operations (1948)',
  'State of Israel (1948 - present)',
  "Iran's Axis of Resistance (1979 - present)",
  'Iraqi Shia Militias (2003)',
  'Palestinian Intifadas (1987 - 2005)',
  'U.S. War on Terror (2001 - 2021)',
  'Iraq War (2003 - 2011)',
  'Arab Spring (2010 - 2012)',
  'Gaza War (2023 - present)',
  'Hamas Attack on Israel (2023)',
  'Israel-Hezbollah Conflict (2023 - present)',
  'Israel-Houthi Conflict (2023 - present)',
  'Iran-Israel Escalation (2024)',
  'America (1945 - present)',
  "Israeli Influence over America (1945 - present)",
  'Watergate (1972 - 1974)',
  '2024 Presidential Election',
  'Post-Cold War Era (1991 - 2001)',
  'Yugoslav Wars (1991 - 2001)',
  'Late 1990s Global Financial Crises (1994 - 2002)',
  'Global Financial Crisis (2008 - 2009)',
  'Russo-Ukrainian War (2014 - present)',
  'Soviet-Afghan War (1979 - 1989)',
  'Church Committee (1975 - 1976)',
  'War in Afghanistan (2001 - 2021)',
  'Apollo Program (1961 - 1972)',
  'History of Philosophy',
  'Vedic Indian Philosophy (16th c BC - 6th c BC)',
  'Classical Chinese Philosophy (6th c BC - 3rd c BC)',
  'Confucianism (551 BC - present)',
  'Daoism (6th c BC - present)',
  'Legalism (4th c BC - 3rd c BC)',
  'Ancient Western Philosophy (6th c BC - 5th c AD)',
  'Ancient Greek Philosophy (6th c BC - 1st c BC)',
  'Pre-Socratic Philosophy (6th c BC - 5th c BC)',
  'Milesian School/Ionian School (6th c BC)',
  'Italian School (6th c BC - 5th c BC)',
  'Eleatic School (5th c BC)',
  'Pluralists (5th c BC)',
  'Atomists (5th c BC)',
  'Classical Greek Philosophy (5th c BC - 4th c BC)',
  'Sophists (5th c BC - 4th c BC)',
  'Hellenistic Philosophy (3rd c BC - 1st c BC)',
  'Skepticism (4th c BC - 3rd c AD)',
  'Pyrrhonism (360 BC - present)',
  'Epicureanism (306 BC - present)',
  'The Cynics (4th c BC - 4th c AD)',
  'Stoicism (300 BC - present)',
  'Early Stoa (300 BC - 2nd c BC)',
  'Middle Stoa (2nd c BC - 1st c AD)',
  'Late Stoa/Roman Stoicism (1st c AD - 2nd c AD)',
  'Roman Philosophy (1st c AD - 5th c)',
  'Late Antiquity (1st c AD - 6th c AD)',
  'Imperial Philosophy (27 BC - 6th c AD)',
  'Neoplatonism (3rd c AD - 6th c AD)',
  'Early Christian Philosophy (150 AD - 500 AD)',
  'Late Neoplatonism (350 AD - 500 AD)',
  'The Transition to Medieval Philosophy (500 AD - 800 AD)',
  'Classical Indian Philosophy (6th c BC - 11th c AD)',
  'Jainism (8th c BC - present)',
  'Indian Buddhism (6th c BC - present)',
  'Imperial Chinese Philosophy (3rd c BC - 20th c AD)',
  'Neo-Confucianism (960 - present)',
  'Chinese Buddhism (1st c AD - present)',
  'Medieval Western Philosophy (5th c - 15th c)',
  'Early Medieval (5th c - 11th c)',
  'Scholasticism (11th c - 17th c)',
  'Nominalism (11th c - 21st c)',
  'Thomism (13th c - 21st c)',
  'Neo-Thomism (19th c - present)',
  'Scotism (13th c - 21st c)',
  'Golden Age Islamic Philosophy (8th c - 13th c)',
  'Medieval Indian Philosophy (8th c - 18th c)',
  'Vedanta Schools (8th c - present)',
  'Post-Classical Islamic Philosophy (13th c - 19th c)',
  'Western Renaissance Philosophy (15th c - 16th c)',
  'Early Modern Western Philosophy (17th c - 18th c)',
  'Continental Rationalism (17th c)',
  'British Empiricism (17th c - 18th c)',
  'The Enlightenment (18th c)',
  'Scottish Enlightenment (1740-1790)',
  'Scottish Common Sense Realism (18th c - 19th c)',
  'Scottish Moral Philosophy (18th c - 19th c)',
  'Edo Japanese Philosophy (1603-1868)',
  'Late Modern Western Philosophy (19th c)',
  'German Idealism (1780\'s - 1840s)',
  'Utilitarianism (18th c - present)',
  'Anthropological Materialism (19th c)',
  'Marxism (1818-present)',
  'Existentialism (19th c - present)',
  'Depth Psychology/Analytical Psychology/Psychology of Religion (1880-1970)',
  'Modern Indian Philosophy (19th c - 21st c)',
  'Modern Japanese Philosophy (19th c - 21st c)',
  'Modern Chinese Philosophy (20th c - 21st c)',
  'Modern Islamic Philosophy (20th c - 21st c)',
  'Modern African Philosophy (20th c - 21st c)',
  'Contemporary Western Philosophy (19th c - 21st c)',
  'Pragmatism (1870s - present)',
  'Analytic Philosophy (1900s - present)',
  'Contemporary Political Philosophy (19th c - 21st c)',
  'American Political Philosophy (20th c)',
  'Continental Philosophy (1920s - present)',
  'Critical Theory (1920s-present)',
  'The Frankfurt School (1923 - present)',
  'Postmodernism (1960-present)',
  'Post-structuralism (1960s-present)',
  'Determinism',
  'Logical Determinism/Fatalism',
  'The 10 Categories of Being',
  'Substance',
  'Types of Substance',
  'Change',
  'Four Causes',
  'Non-Substance Categories',
  'Aquinas\'s 5 Ways',
  'Cosmological Arguments',
  'The Unmoved Mover Argument',
  'The First Cause Argument',
  'The Contingency Argument',
  'If everything were contingent, nothing would exist',
  'Illustrative Analogies',
  'Challenge',
  'Descartes\' Arguments for the Existence of God',
  'The Trademark/Causal Argument',
  'The Ontological Argument',
  'The Argument from the Preservation of Existence',
  // Biblical Studies
  'Biblical Studies',
  // Verse-level passages
  '1:1–2 (The Initial State)',
  '1:3–5 (Day One: Light)',
  '1:6–8 (Day Two: The Expanse)',
  '1:9–13 (Day Three: Land and Vegetation)',
  '1:24–31 (Day Six: Land Animals and Humanity)',
  '2:1–3 (Day Seven: The Divine Rest)',
  '2:18–25 (The Creation of Woman)',
  '3:14–19 (The Curses and Consequences)',
  '4 (Cain and Abel)',
  '15 (The Covenant of the Pieces)',
  '8:20–32 (The Fourth Plague: Flies)',
  '9:1–7 (The Fifth Plague: Livestock Die)',
  '9:13–35 (The Seventh Plague: Hail)',
  '12:1–13 (The Passover Lamb)',
  '20:1–17 (The Ten Commandments)',
  '21:12–36 (Laws on Violence and Animal Liability)',
  '22:16–31 (Social and Religious Statutes)',
  '26 (The Tabernacle Structure)',
  '39:1–31 (The Priestly Garments)',
  '21:1–9 (Regulations for Ordinary Priests)',
  '24:10–23 (The Law of Blasphemy and Retribution)',
  '25:35–55 (The Redemption of the Poor and Enslaved)',
  '26 (Blessings and Curses)',
  '6:22–27 (The Priestly Blessing)',
  '20:1–13 (Water from the Rock at Meribah)',
  '25 (Apostasy at Shittim)',
  '5:6–21 (The Ten Commandments)',
  '13 (Warning Against Idolatry)',
  '21:22–23 (Burial of a Hanged Man)',
  '28:45–68 (The Ultimate Curse: Exile)',
  '32:1–43 (The Song of Moses)',
  'Old Testament/Hebrew Bible (Tanakh)',
  'The Pentateuch (The Law/Torah)',
  'Genesis',
  '1–2:3 (The Seven Days of Creation)',
  '2:4–3 (The Garden of Eden and the Fall)',
  '11:10–25:11 (The Abrahamic Cycle)',
  '37–50 (The Story of Joseph)',
  '41 (Pharaoh\'s Dreams and Joseph\'s Rise)',
  'Exodus',
  '7 (The Ten Plagues of Egypt)',
  '12–13:16 (The Passover and Exodus)',
  '19–24 (The Covenant and Ten Commandments at Sinai)',
  '21–23 (The Book of the Covenant)',
  '25–31 (Instructions for the Tabernacle)',
  '35–40 (The Construction and Dedication of the Tabernacle)',
  'Leviticus',
  '17–26 (The Holiness Code)',
  '21–22 (Regulations for Priestly Holiness)',
  '23–25 (The Sacred Calendar and Land Sabbath)',
  '25 (The Sabbatical and Jubilee Years)',
  'Numbers',
  '5–10:10 (Purification and Preparation for the Journey)',
  '20–25 (The Journey from Kadesh to Moab)',
  'Deuteronomy',
  '4:44–26 (The Exposition of the Law)',
  '5 (The Ten Commandments)',
  '12–16:17 (Ceremonial and Ritual Laws)',
  '19–25 (Social and Criminal Statutes)',
  '21:10–25:19 (Miscellaneous Civil and Domestic Laws)',
  '27–28 (Blessings and Curses)',
  '31–34 (The Final Days of Moses)',
  // Historical Books
  'Historical Books',
  'Joshua',
  '1:1–5:12 (Entering the Promised Land)',
  '5:13–12:24 (The Conquest of Canaan)',
  'Judges',
  'Ruth',
  '1 Samuel',
  '16–17 (The Anointing of David and Victory over Goliath)',
  '2 Samuel',
  '1 Kings',
  '9:10–11:43 (Solomon\'s Splendor and Decline)',
  '2 Kings',
  '1–2:18 (The Transition from Elijah to Elisha)',
  '2:19–8:15 (The Miracles and Ministry of Elisha)',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',

  'Esther',
  // Poetic/Wisdom Books
  'Poetic/Wisdom Books',
  'Job',
  '1–2 (The Prologue)',
  '3–31 (The Dialogue Cycles)',
  '22–27 (The Third Cycle of Speeches)',
  '25 (Bildad\'s Third Speech)',
  '38–41 (The Divine Speeches)',
  '38 (The Lord Answers Job from the Whirlwind)',
  'Psalms',
  '1–41 (Book I: Genesis Comparison)',
  '19–24 (God\'s Glory, Law, and Kingship)',
  '22 (The Suffering Servant)',
  '22–31 (The Vow of Praise and Victory)',
  '42–72 (Book II: Exodus Comparison)',
  '64–68 (God\'s Power in Nature and History)',
  '66 (A Liturgy of Thanksgiving)',
  '73–89 (Book III: Leviticus Comparison)',
  '86–88 (Prayers in Deep Distress)',
  '86 (A Prayer in the Day of Trouble)',
  'Proverbs',
  '1–9 (The Prologue: Exhortations to Wisdom)',
  '8 (Wisdom\'s Autobiography)',
  '25–29 (Hezekiah\'s Collection of Solomon\'s Proverbs)',
  '30 (The Sayings of Agur)',
  '30:1–9 (The Wisdom of Agur)',
  '25–29 (Hezekiah\'s Collection of Solomon\'s Proverbs)',
  '29 (Leadership and Social Order)',
  '12–21 (The Character and Authority of Wisdom)',
  '22–31 (Wisdom\'s Role in Creation)',
  '8 (Wisdom\'s Autobiography)',
  'Ecclesiastes',
  '3 (A Time for Everything)',
  'A Time for Everything (3:1–8)',
  '25 (Bildad\'s Third Speech)',
  '25 (The Insignificance of Man)',
  '38 (The Lord Answers Job from the Whirlwind)',
  '38 (Foundations of the Earth and Sea)',
  '22 (The Suffering Servant)',
  '1–21 (The Cry of Anguish and Forsakenness)',
  '23 (The Good Shepherd)',
  'Song of Solomon',
  // Prophetic Books
  'Prophetic Books',
  'The Major Prophets',
  'Isaiah',
  '1–35 (Judgment and Promise)',
  '2–4 (The Mountain of the Lord and the Day of Judgment)',
  '13:1–23:18 (Oracles Against the Nations)',
  '13:1–14:23 (The Oracle Against Babylon)',
  '19 (The Oracle Against Egypt)',
  '19:23–25 (A Highway of Blessing)',
  '36–39 (Historical Interlude)',
  '37:21–38 (The Fall of the Assyrians)',
  '40–48 (Deliverance for Exiles)',
  '43:1–44:5 (Israel\'s Only Savior)',
  '43:1–7 (Israel\'s Only Savior)',
  '44:24–45:25 (The Commission of Cyrus)',
  '49–57 (The Servant\'s Ministry)',
  '52:13–53:12 (The Fourth Servant Song)',
  '53:1–3 (The Servant\'s Lowly Origins and Rejection)',
  '53:4–6 (The Servant\'s Substitutionary Suffering)',
  '55:1–5 (An Invitation to the Thirsty)',
  '55:6–9 (The Call to Repentance)',
  '56:9–57:13 (Rebuking the Wicked Leaders)',
  '56:9–12 (The Blind Watchmen)',
  '13:1–8 (The Call to Arms)',
  '13:9–16 (The Day of the Lord)',
  'Jeremiah',
  '1 (The Prophet\'s Call)',
  '1:4–10 (The Call of Jeremiah)',
  '11–20 (Jeremiah\'s Struggles and Confessions)',
  '17 (The Heart\'s Deceit and the Sabbath)',
  '1–4 (Judah\'s Indelible Sin)',
  '9–11 (The Deceitful Heart)',
  '12–18 (Jeremiah\'s Prayer for Healing)',
  '20 (Conflict with Pashhur and a Final Lament)',
  '26–29 (Conflict with False Prophets)',
  '29 (A Letter to the Exiles)',
  '29:1–9 (Instructions to the Exiles)',
  '30–33 (The Book of Consolation)',
  '31 (The New Covenant)',
  '31:31–34 (The New Covenant)',
  'Lamentations',
  'Ezekiel',
  '25–32 (Oracles Against the Nations)',
  '28:11–19 (A Lament for the King of Tyre)',
  'Daniel',
  '2–6 (The Court Tales and God\'s Sovereignty)',
  '3 (The Fiery Furnace)',
  '8–9 (The Ram, the Goat, and the Seventy Weeks)',
  '9:24–27 (The Prophecy of the Seventy Weeks)',
  '10–12 (The Final Vision and the End of Days)',
  '11:36–45 (The Self-Exalting King)',
  'The Minor Prophets (The Twelve)',
  'Hosea',
  'Joel',
  'Amos',
  '3:1–6:14 (Indictments of Social Injustice)',
  '5:16–27 (The Day of the Lord and the Rejection of Ritual)',
  'Obadiah',
  'Jonah',
  'Micah',
  '7:8–20 (A Prayer of Confidence and Divine Forgiveness)',
  'Nahum',
  '1 (The Majesty of God in Judgment)',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  // New Testament
  'New Testament',
  // Historical Books verse parents
  '1:1–9 (The Commissioning of Joshua)',
  '3 (Crossing the Jordan)',
  '10 (The Southern Campaign)',
  '7 (The Davidic Covenant)',
  '11:1–13 (Solomon\'s Apostasy)',
  '1:9–16 (Fire from Heaven)',
  '2:19–25 (Healing of the Water and the Curse of the Lads)',
  '16–17 (The Anointing of David and Victory over Goliath)',
  '17:41–54 (David Kills Goliath)',
]);

// Topic keywords for semantic search fallback - helps suggest related topics when no exact match
const TOPIC_KEYWORDS = {
  'Philosophy': ['metaphysic', 'epistem', 'ethics', 'logic', 'ontology', 'kant', 'plato', 'aristotle', 'descartes', 'hume', 'locke', 'spinoza', 'nietzsche', 'wittgenstein', 'phenomenology', 'hermeneutic', 'moral philosophy', 'political philosophy', 'philosophy of mind', 'ancient philosophy', 'modern philosophy', 'continental philosophy', 'analytic philosophy'],
  'Metaphysics': ['being', 'substance', 'exist', 'reality', 'essence', 'modal', 'necessity', 'abstract', 'universal', 'free will', 'mind body', 'personal identity'],
  'Epistemology': ['knowledge', 'justify', 'belief', 'truth', 'reason', 'empiric', 'rational', 'induction', 'deduction', 'skeptic', 'theory of knowledge', 'justified true belief'],
  'Ethics': ['moral', 'virtue', 'value', 'right', 'wrong', 'good', 'duty', 'consequent', 'utilit', 'deontolog', 'moral philosophy', 'virtue ethics', 'applied ethics', 'moral theory'],
  'Aesthetics': ['beauty', 'art', 'taste', 'sublime', 'aesthetic', 'judgment', 'form', 'expression', 'creative', 'philosophy of art', 'aesthetic experience'],
  'Logic': ['argument', 'premise', 'conclusion', 'valid', 'fallacy', 'symbolic', 'propositional', 'predicate', 'formal logic', 'symbolic logic', 'logical reasoning'],
  'Political Philosophy': ['government', 'state', 'power', 'rights', 'freedom', 'justice', 'law', 'democracy', 'politics', 'authority', 'social contract', 'sovereignty', 'constitution', 'political theory', 'civil rights', 'human rights'],
  
  'Biology': ['organism', 'genetic', 'cell', 'evolution', 'species', 'anatomy', 'physiology', 'reproductive', 'penis', 'vagina', 'breast', 'uterus', 'ovary', 'testis', 'dna', 'protein', 'enzyme', 'metabolism', 'photosynthesis', 'biodiversity', 'ecology', 'mutation', 'blood', 'heart', 'lung', 'kidney', 'liver', 'brain', 'nerve', 'muscle', 'bone', 'tissue', 'cell biology', 'molecular biology', 'evolutionary biology', 'marine biology', 'human biology', 'natural selection'],
  'Chemistry': ['chemical', 'molecule', 'element', 'compound', 'reaction', 'atom', 'periodic', 'carbon', 'hydrogen', 'bond', 'oxidation', 'crystalline', 'ionic', 'valence', 'electrolyte', 'organic chemistry', 'inorganic chemistry', 'physical chemistry', 'chemical reaction', 'periodic table'],
  'Physics': ['motion', 'energy', 'force', 'quantum', 'relativity', 'gravity', 'wave', 'particle', 'einstein', 'newtonian', 'acceleration', 'velocity', 'momentum', 'thermodynamic', 'electromag', 'quantum mechanics', 'quantum physics', 'theory of relativity', 'general relativity', 'special relativity', 'particle physics', 'nuclear physics', 'classical mechanics'],
  'Mathematics': ['number', 'algebra', 'geometry', 'calculus', 'equation', 'theorem', 'proof', 'probability', 'linear', 'matrix', 'trigonometry', 'topology', 'set theory', 'function', 'integral', 'derivative', 'number theory', 'abstract algebra', 'differential equations', 'linear algebra'],
  'Astronomy': ['space', 'star', 'planet', 'galaxy', 'cosmic', 'universe', 'asteroid', 'satellite', 'nebula', 'black hole', 'constellation', 'orbit', 'celestial', 'meteor', 'solar system', 'milky way', 'outer space', 'planetary science'],
  'Earth Science': ['geology', 'earth', 'weather', 'climate', 'mineral', 'rock', 'plate tectonics', 'volcano', 'earthquake', 'erosion', 'atmosphere', 'ocean', 'soil', 'climate change', 'global warming', 'natural disaster', 'earth science'],
  
  'History': ['ancient', 'medieval', 'modern', 'era', 'period', 'century', 'war', 'civilization', 'revolution', 'empire', 'dynasty', 'renaissance', 'industrial', 'historical', 'world war', 'civil war', 'cold war', 'ancient history', 'modern history', 'medieval period', 'ancient greece', 'ancient rome', 'ancient egypt', 'world history', 'european history', 'american history', 'industrial revolution', 'french revolution'],
  'Religious Studies': ['religion', 'theology', 'faith', 'spiritual', 'church', 'prayer', 'sermon', 'scripture', 'god', 'divine', 'sacred', 'ritual', 'worship', 'doctrine', 'belief system', 'world religion', 'comparative religion', 'religious studies'],
  'Western Religions': ['christianity', 'judaism', 'islam', 'church', 'torah', 'quran', 'theology', 'monotheistic', 'abrahamic religions', 'western religion'],
  'Eastern Religions': ['buddhism', 'hinduism', 'taoism', 'confucian', 'zen', 'karma', 'dharma', 'meditation', 'enlightenment', 'eastern philosophy', 'eastern religion', 'zen buddhism'],
  'Christianity': ['jesus', 'christ', 'gospel', 'church', 'trinity', 'salvation', 'cross', 'theology', 'sacrament', 'new testament', 'old testament', 'christian theology'],
  'Islam': ['allah', 'muhammad', 'quran', 'mosque', 'jihad', 'shariah', 'five pillar', 'sunni', 'shia', 'islamic law', 'five pillars', 'islamic theology'],
  'Buddhism': ['buddha', 'enlightenment', 'dharma', 'karma', 'meditation', 'nirvana', 'bodhisattva', 'zen', 'tibetan', 'buddhist philosophy', 'tibetan buddhism', 'zen buddhism'],
  
  'Psychology': ['mind', 'behavior', 'conscious', 'mental', 'cognitive', 'freud', 'brain', 'emotion', 'therapy', 'psyche', 'conditioning', 'perception', 'memory', 'development', 'personality', 'disorder', 'cognitive psychology', 'social psychology', 'developmental psychology', 'clinical psychology', 'mental health', 'behavioral psychology'],
  'Neuroscience': ['brain', 'neural', 'cognitive', 'synapse', 'neuron', 'neurological', 'behavioral', 'cortex', 'cerebral', 'cognitive neuroscience', 'brain science', 'neural network'],
  'Sociology': ['society', 'social', 'culture', 'community', 'group', 'institution', 'class', 'identity', 'network', 'conflict', 'structure', 'norm', 'social structure', 'social science', 'social theory', 'cultural sociology'],
  'Anthropology': ['culture', 'human', 'society', 'ritual', 'kinship', 'ethnography', 'tribe', 'social structure', 'evolutionary', 'cultural anthropology', 'physical anthropology', 'human evolution'],
  'Economics': ['market', 'trade', 'money', 'economy', 'business', 'price', 'supply', 'demand', 'investment', 'capital', 'labor', 'inflation', 'gdp', 'commerce', 'supply and demand', 'economic theory', 'market economy', 'free market', 'macroeconomics', 'microeconomics'],
  
  'Arts': ['art', 'visual', 'painting', 'sculpture', 'gallery', 'creative', 'aesthetic', 'design', 'craft', 'medium', 'composition', 'perspective', 'visual arts', 'fine arts', 'modern art', 'contemporary art', 'art history'],
  'Visual Arts': ['painting', 'sculpture', 'drawing', 'graphics', 'color', 'form', 'perspective', 'composition', 'architecture', 'visual art', 'fine art', 'graphic design'],
  'Performing Arts': ['theater', 'dance', 'performance', 'acting', 'stage', 'drama', 'script', 'choreography', 'performing art', 'theatre arts'],
  'Music': ['musical', 'song', 'melody', 'harmony', 'composition', 'instrument', 'audio', 'rhythm', 'note', 'scale', 'tempo', 'orchestra', 'concert', 'classical music', 'jazz music', 'rock music', 'music theory', 'music history'],
  'Literature': ['novel', 'poetry', 'writing', 'author', 'story', 'narrative', 'character', 'plot', 'fiction', 'prose', 'verse', 'metaphor', 'world literature', 'english literature', 'american literature', 'literary theory', 'creative writing'],
  'Languages': ['language', 'linguistic', 'grammar', 'syntax', 'translation', 'dialect', 'communication', 'phonetic', 'semantic', 'etymology', 'vocabulary', 'second language', 'foreign language', 'language learning'],
  'Statistics': ['data', 'probability', 'distribution', 'variance', 'mean', 'regression', 'sampling', 'hypothesis', 'correlation', 'statistical analysis', 'data analysis', 'probability theory'],
}

const applyLabelMigrations = (mapNodes) => {
  if (!Array.isArray(mapNodes)) return { nodes: [], changed: false }

  const orderedVersions = Object.keys(LABEL_MIGRATIONS_BY_VERSION)
    .map((version) => Number(version))
    .sort((a, b) => a - b)

  let changed = false
  const migratedNodes = mapNodes.map((node) => {
    let nextLabel = node.label

    orderedVersions.forEach((version) => {
      const versionMap = LABEL_MIGRATIONS_BY_VERSION[version]
      nextLabel = versionMap[nextLabel] || nextLabel
    })

    if (nextLabel === node.label) return node

    changed = true
    return {
      ...node,
      label: nextLabel,
    }
  })

  return { nodes: migratedNodes, changed }
}

const buildLayout = (nodes, topicSubdivisions = {}, nodeWidth = NODE_WIDTH, nodeHeight = NODE_HEIGHT) => {
  if (nodes.length === 0) {
    return { positions: new Map(), edges: [], bounds: null };
  }

  const root = nodes.find((node) => node.parentId == null) || nodes[0];
  const childrenById = new Map();
  nodes.forEach((node) => {
    childrenById.set(node.id, []);
  });
  nodes.forEach((node) => {
    if (node.parentId != null && childrenById.has(node.parentId) && !node.hidden) {
      childrenById.get(node.parentId).push(node);
    }
  });

  // Sort children: use topicSubdivisions order for specific parents, otherwise alphabetically
  childrenById.forEach((children, parentId) => {
    const parentNode = nodes.find(n => n.id === parentId);
    const parentLabel = parentNode?.label;
    
    // If this parent is marked for ordered children, use topicSubdivisions order; otherwise alphabetize
    if (parentLabel && topicSubdivisions[parentLabel] && ORDERED_CHILDREN_PARENTS.has(parentLabel)) {
      const definedOrder = topicSubdivisions[parentLabel];
      children.sort((a, b) => {
        if (a.isCustom || b.isCustom) {
          return a.label.localeCompare(b.label);
        }
        const indexA = definedOrder.indexOf(a.label);
        const indexB = definedOrder.indexOf(b.label);
        // If both exist in defined order, use that; otherwise sort alphabetically
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
    } else {
      // Default alphabetical sort for nodes without defined order
      children.sort((a, b) => a.label.localeCompare(b.label));
    }
  });

  const positions = new Map();
  const edges = [];
  const subtreeWidths = new Map();

  const calculateSubtreeWidth = (nodeId) => {
    const kids = childrenById.get(nodeId) || [];
    if (kids.length === 0) {
      subtreeWidths.set(nodeId, nodeWidth);
      return nodeWidth;
    }

    let totalWidth = 0;
    kids.forEach((child, index) => {
      totalWidth += calculateSubtreeWidth(child.id);
      if (index > 0) totalWidth += H_GAP;
    });

    const width = Math.max(totalWidth, nodeWidth);
    subtreeWidths.set(nodeId, width);
    return width;
  };

  const assignPositions = (nodeId, x, y) => {
    const kids = childrenById.get(nodeId) || [];
    const subtreeWidth = subtreeWidths.get(nodeId) || nodeWidth;
    const nodeX = x + (subtreeWidth - nodeWidth) / 2;

    positions.set(nodeId, { x: nodeX, y });

    let childX = x;
    kids.forEach((child) => {
      edges.push({ from: nodeId, to: child.id });
      const childWidth = subtreeWidths.get(child.id) || nodeWidth;
      assignPositions(child.id, childX, y + nodeHeight + V_GAP);
      childX += childWidth + H_GAP;
    });
  };

  calculateSubtreeWidth(root.id);
  assignPositions(root.id, 0, 0);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });

  return {
    positions,
    edges,
    bounds: { minX, minY, maxX, maxY },
  };
};

function App() {
  const isMobile = useMobileHeaderSpacer();

  // State to force recenter animation
  const [recenterKey, setRecenterKey] = useState(0);
  const [forceRecenter, setForceRecenter] = useState(false);
  // ...existing hooks and constants...


    // Robustly skip auto-save after backend loads
    const skipNextAutoSave = useRef(false);

    // Helper for backend-driven node updates
    const setNodesFromBackend = (newNodes) => {
      skipNextAutoSave.current = true;
      setNodes(newNodes);
    };

    const normalizeLoadedNodes = (mapNodes) => {
      return applyLabelMigrations(mapNodes)
    }

    const collapseNodesToRoot = (mapNodes) => {
      return mapNodes.map((node) => ({
        ...node,
        hidden: node.parentId !== null,
      }))
    }
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const [selectedId, setSelectedId] = useState(null)
  const [focusedElement, setFocusedElement] = useState(null) // { nodeId, type: 'node' | 'dots' } or null


  const [panelOpen, setPanelOpen] = useState(false)
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [headerHeight, setHeaderHeight] = useState(0)
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })
  const [animatingIds, setAnimatingIds] = useState(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [midPanAnchor, setMidPanAnchor] = useState(null)
  const midPanMouseRef = useRef(null)
  const midPanRafRef = useRef(null)
  const [dragStart, setDragStart] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [basePanOffset, setBasePanOffset] = useState({ x: 0, y: 0 })
  const [dragButton, setDragButton] = useState(null)



  const [openTooltip, setOpenTooltip] = useState(null)
  const [enableAnimations, setEnableAnimations] = useState(true)
  const [smoothPanning, setSmoothPanning] = useState(true)
  const [autoExpand, setAutoExpand] = useState(true)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)
  const [showFullscreenHint, setShowFullscreenHint] = useState(false)
  const [showCreateNodeHint, setShowCreateNodeHint] = useState(false)
  const [nodeSizeScale, setNodeSizeScale] = useState(() => {
    const raw = window.localStorage.getItem('nodeSizeScale')
    const parsed = Number.parseFloat(raw || '')
    if (!Number.isFinite(parsed)) return 1
    return Math.max(NODE_SIZE_MIN, Math.min(NODE_SIZE_MAX, parsed))
  })
  const [currentUser, setCurrentUser] = useState(null)
  const [nodeFiles, setNodeFiles] = useState({}) // Map of nodeId -> files array
  const [uploadingNodeId, setUploadingNodeId] = useState(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [storageUsage, setStorageUsage] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1)
  const [relatedIdeas, setRelatedIdeas] = useState([])
  const [hasValidSearchWords, setHasValidSearchWords] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState(null) // For tree view editing
  const [editingSidebarNodeId, setEditingSidebarNodeId] = useState(null) // For sidebar title editing
  const [deleteConfirmation, setDeleteConfirmation] = useState(null) // { nodeId, message }
  const [signInRequired, setSignInRequired] = useState(null) // message string or null
  const [editingSummaryId, setEditingSummaryId] = useState(null)
  const [notification, setNotification] = useState(null) // { message, type: 'error' | 'success' | 'info' }
  const [lastCreatedGridId, setLastCreatedGridId] = useState(null) // Track newly created grid for Tab indent
  const [deleteModalChoice, setDeleteModalChoice] = useState('cancel') // 'cancel' | 'delete'
  const [createNodeMode, setCreateNodeMode] = useState(null) // 'child' | 'sibling' | null - for button-based node creation
  const [createNodeHintPosition, setCreateNodeHintPosition] = useState(null)

  const canvasRef = useRef(null)
  const editInputRef = useRef(null)
  const mapPanelRef = useRef(null)
  const headerRef = useRef(null)
  const createModeButtonsRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchRowRef = useRef(null)
  const searchSuggestionsRef = useRef(null)
  const anchorSizeRef = useRef({ width: 0, height: 0 })
  const nextId = useRef(2)
  const prevSelectedIdRef = useRef(null)
  const prevFocusedElementRef = useRef(null)
  const lastShiftRef = useRef({ x: 0, y: 0 })
  const lastFocusedIdRef = useRef(null)
  const layoutRef = useRef(null)
  const maxPanYRef = useRef(2000)
  const didDragRef = useRef(false)
  const suppressClickRef = useRef(false)
  const noteInputRefs = useRef({})
  const deleteCancelButtonRef = useRef(null)
  const deleteConfirmButtonRef = useRef(null)
  const searchRequestIdRef = useRef(0)
  const searchDebounceTimeoutRef = useRef(null)
  const datamuseWordValidityCacheRef = useRef(new Map())
  const datamuseSuggestionCacheRef = useRef(new Map())
  const draftNoteIdsRef = useRef(new Set())
  const draftGridIdsRef = useRef(new Set())

  // Keyboard shortcut: Ctrl+F toggles fullscreen mode
  useEffect(() => {
    // No fullscreen keyboard shortcut; only allow via UI button
  }, [isFullscreenMode, deleteConfirmation]);
  // ...existing code...

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      setNotification(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    return () => {
      if (searchDebounceTimeoutRef.current) {
        clearTimeout(searchDebounceTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!showFullscreenHint) return
    const timer = setTimeout(() => {
      setShowFullscreenHint(false)
    }, 2200)
    return () => clearTimeout(timer)
  }, [showFullscreenHint])

  useEffect(() => {
    if (!showCreateNodeHint) return
    const timer = setTimeout(() => {
      setShowCreateNodeHint(false)
    }, 2200)
    return () => clearTimeout(timer)
  }, [showCreateNodeHint])

  useEffect(() => {
    if (!showCreateNodeHint || !createNodeMode) {
      setCreateNodeHintPosition(null)
      return
    }

    const updateHintPosition = () => {
      const buttonGroup = createModeButtonsRef.current
      if (!buttonGroup) return
      const rect = buttonGroup.getBoundingClientRect()
      setCreateNodeHintPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      })
    }

    updateHintPosition()
    window.addEventListener('resize', updateHintPosition)
    window.addEventListener('scroll', updateHintPosition, true)

    return () => {
      window.removeEventListener('resize', updateHintPosition)
      window.removeEventListener('scroll', updateHintPosition, true)
    }
  }, [showCreateNodeHint, createNodeMode])

  const toggleFullscreenMode = () => {
    setIsFullscreenMode((prev) => {
      const next = !prev
      if (next) {
        setShowFullscreenHint(true)
      } else {
        setShowFullscreenHint(false)
      }
      setOpenTooltip(null)
      return next
    })
  }

  const toggleCreateNodeMode = (mode) => {
    setCreateNodeMode((prev) => {
      const next = prev === mode ? null : mode
      setShowCreateNodeHint(next !== null)
      if (next === null) {
        setCreateNodeHintPosition(null)
      }
      return next
    })
  }

  // Keep keyboard focus aligned with the selected delete modal option.
  useEffect(() => {
    if (!deleteConfirmation) return
    const targetRef = deleteModalChoice === 'delete' ? deleteConfirmButtonRef : deleteCancelButtonRef
    targetRef.current?.focus()
  }, [deleteConfirmation, deleteModalChoice])

  // Close side panel when ESC is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && panelOpen) {
        e.preventDefault()
        setPanelOpen(false)
        setSelectedId(null)
        setPanelExpanded(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [panelOpen])

  // Auto-scroll highlighted suggestion into view
  useEffect(() => {
    if (highlightedSuggestion >= 0 && searchSuggestionsRef.current) {
      const container = searchSuggestionsRef.current
      const items = container.querySelectorAll('[data-suggestion-index]')
      if (items[highlightedSuggestion]) {
        const item = items[highlightedSuggestion]
        // Scroll the parent container if needed
        const containerRect = container.getBoundingClientRect()
        const itemRect = item.getBoundingClientRect()
        
        if (itemRect.bottom > containerRect.bottom) {
          // Scroll down
          container.scrollTop += itemRect.bottom - containerRect.bottom + 10
        } else if (itemRect.top < containerRect.top) {
          // Scroll up
          container.scrollTop -= containerRect.top - itemRect.top + 10
        }
      }
    }
  }, [highlightedSuggestion])

  // Knowledge base mapping topics to their meaningful subdivisions (must be before layout useMemo)
  const TOPIC_SUBDIVISIONS = {
    // Root level
    'Everything': ['Humanities', 'Sciences'],
    'Humanities': ['Philosophy', 'History', 'Religious Studies', 'Arts', 'Languages'],
    'Sciences': ['Physics', 'Chemistry', 'Biology', 'Earth Science', 'Astronomy', 'Mathematics'],
    
    // Philosophy
    'Philosophy': ['Aesthetics', 'Epistemology', 'Ethics/Moral Philosophy', 'History of Philosophy', 'Metaphilosophy', 'Metaphysics', 'Political Philosophy'],

    // Ethics (Restructured with Normative/Metaethics/Applied)
    'Ethics/Moral Philosophy': ['Applied Ethics', 'Metaethics', 'Normative Ethics'],
    'Normative Ethics': ['Aristotle\'s Virtue Ethics', 'Basic Moral Dilemmas', 'Consequentialism', 'Kant\'s Deontology'],
    'Aristotle\'s Virtue Ethics': ['Aristotelian Ethics', 'Character Development', 'Flourishing', 'Moral Exemplars', 'Practical Wisdom', 'Virtues'],
    'Virtues': ['Compassion', 'Courage', 'Honesty', 'Justice', 'Temperance', 'Wisdom'],
    'Compassion': [],
    'Courage': [],
    'Honesty': [],
    'Justice': ['Injustice'],
    'Injustice': [],
    'Temperance': [],
    'Wisdom': [],
    'Aristotelian Ethics': [],
    'Character Development': [],
    'Flourishing': [],
    'Moral Exemplars': [],
    'Practical Wisdom': [],
    'Kant\'s Deontology': ['Categorical Imperative', 'Duty', 'Kant', 'Moral Law', 'Rights', 'Rules'],
    'Categorical Imperative': [],
    'Duty': [],
    'Kant': [],
    'Moral Law': [],
    'Rights': [],
    'Rules': [],
    'Consequentialism': ['Cost-Benefit Analysis', 'Greatest Good', 'Happiness', 'Preference Satisfaction', 'Utilitarianism', 'Well-being'],
    'Cost-Benefit Analysis': [],
    'Greatest Good': [],
    'Happiness': [],
    'Preference Satisfaction': [],
    'Utilitarianism': ['Act Utilitarianism', 'Bentham', 'Hedonic Calculus', 'Preference Utilitarianism', 'Rule Utilitarianism', 'Singer'],
    'Act Utilitarianism': [],
    'Bentham': [],
    'Hedonic Calculus': [],
    'Preference Utilitarianism': [],
    'Rule Utilitarianism': [],
    'Singer': [],
    'Well-being': [],
    'Basic Moral Dilemmas': ['The Trolley Problem', 'Variance in Intuition'],
    'The Trolley Problem': ['The Footbridge Dilemma'],
    'The Footbridge Dilemma': [],
    'Variance in Intuition': [],
    'Metaethics': ['Cognitivism vs Non-cognitivism', 'Moral Nihilism', 'Moral Realism', 'Moral Relativism'],
    'Cognitivism vs Non-cognitivism': ['Cognitivism', 'Non-cognitivism'],
    'Cognitivism': [],
    'Non-cognitivism': ['Emotivism'],
    'Emotivism': [],
    'Moral Realism': [],
    'Moral Relativism': [],
    'Moral Nihilism': [],
    'Applied Ethics': ['Bioethics', 'Business Ethics', 'Computer Ethics', 'Environmental Ethics', 'Medical Ethics', 'Philosophy of Law'],
    'Philosophy of Law': ['Justice before Mercy'],
    'Justice before Mercy': [],
    'Bioethics': ['Gene Ethics', 'Organ Transplantation', 'Genetic Testing', 'Reproductive Ethics'],
    'Gene Ethics': [],
    'Organ Transplantation': [],
    'Genetic Testing': [],
    'Reproductive Ethics': [],
    'Environmental Ethics': [],
    'Business Ethics': [],
    'Medical Ethics': [],
    'Computer Ethics': [],
    
    // Metaphysics
    'Metaphysics': ['Arguments for God\'s Existence', 'Causality', 'Cosmology', 'Free Will vs. Determinism', 'Metaphysics of Modality', 'Ontology', 'Philosophy of Mind', 'Substance Theory', 'Time'],
    'Arguments for God\'s Existence': ['Aquinas\'s 5 Ways', 'Descartes\' Arguments for the Existence of God'],

    // Aquinas's 5 Ways
    'Aquinas\'s 5 Ways': ['Cosmological Arguments', 'The Argument from Gradation of Being', 'The Argument from Governance/Design'],
    'Cosmological Arguments': ['The Unmoved Mover Argument', 'The First Cause Argument', 'The Contingency Argument'],

    'The Unmoved Mover Argument': [
      'We observe change and movement in the world',
      'Movement requires a mover',
      'It\'s impossible to have an infinite regress of movers',
      'There must be an unmoved mover',
    ],
    'We observe change and movement in the world': [],
    'Movement requires a mover': [],
    'It\'s impossible to have an infinite regress of movers': [],
    'There must be an unmoved mover': [],

    'The First Cause Argument': [
      'We observe cause and effect in the world',
      'Effects require an efficient cause',
      'It\'s impossible to have an infinite regress of efficient causes',
      'There must be a first efficient cause',
    ],
    'We observe cause and effect in the world': [],
    'Effects require an efficient cause': [],
    'It\'s impossible to have an infinite regress of efficient causes': [],
    'There must be a first efficient cause': [],

    'The Contingency Argument': [
      'We observe contingent things',
      'If everything were contingent, nothing would exist',
      'Since things exist, there must be a necessary being',
      'That necessary being is God',
    ],
    'We observe contingent things': [],
    'If everything were contingent, nothing would exist': ['Illustrative Analogies', 'Challenge'],
    'Illustrative Analogies': ['The Chain Analogy', 'The Domino Analogy'],
    'The Chain Analogy': [],
    'The Domino Analogy': [],
    'Challenge': ['Rowe\'s Hume-Edwards Principle'],
    'Rowe\'s Hume-Edwards Principle': [],
    'Since things exist, there must be a necessary being': [],
    'That necessary being is God': [],

    'The Argument from Gradation of Being': [
      'Things have varying degrees of perfection',
      'Degrees of perfection imply a maximum perfection',
      'There must be a maximum perfection (God)',
    ],
    'Things have varying degrees of perfection': [],
    'Degrees of perfection imply a maximum perfection': [],
    'There must be a maximum perfection (God)': [],

    'The Argument from Governance/Design': [
      'Things without intelligence act purposefully',
      'Purposeful action implies an intelligent director',
      'There must be an intelligent director (God)',
    ],
    'Things without intelligence act purposefully': [],
    'Purposeful action implies an intelligent director': [],
    'There must be an intelligent director (God)': [],

    // Descartes' Arguments
    'Descartes\' Arguments for the Existence of God': ['The Trademark/Causal Argument', 'The Ontological Argument', 'The Argument from the Preservation of Existence'],

    'The Trademark/Causal Argument': [
      'I have an idea of God',
      'A cause must be at least as perfect as its effect',
      'My idea of God is supremely perfect',
      'Therefore God must exist as the cause of that idea',
    ],
    'I have an idea of God': [],
    'A cause must be at least as perfect as its effect': [],
    'My idea of God is supremely perfect': [],
    'Therefore God must exist as the cause of that idea': [],

    'The Ontological Argument': [
      'God is defined as a supremely perfect being',
      'Existence is a perfection',
      'God must possess all perfections',
      'Therefore God must exist',
    ],
    'God is defined as a supremely perfect being': [],
    'Existence is a perfection': [],
    'God must possess all perfections': [],
    'Therefore God must exist': [],

    'The Argument from the Preservation of Existence': [
      'I exist now',
      'My continued existence requires a cause',
      'That cause must be me, my past self, or something else',
      'I am not the cause of my own existence',
      'My past self cannot be the cause',
      'Therefore something else must be sustaining my existence',
      'That sustaining cause is God',
    ],
    'I exist now': [],
    'My continued existence requires a cause': [],
    'That cause must be me, my past self, or something else': [],
    'I am not the cause of my own existence': [],
    'My past self cannot be the cause': [],
    'Therefore something else must be sustaining my existence': [],
    'That sustaining cause is God': [],
    'Causality': [],
    'Free Will vs. Determinism': ['Agency', 'Compatibilism', 'Determinism', 'Free Will', 'Indeterminism', 'Libertarianism', 'Responsibility'],
    'Free Will': [],
    'Agency': [],
    'Compatibilism': [],
    'Determinism': ['Causal/Physical Determinism', 'Logical Determinism/Fatalism', 'Theological Determinism'],
    'Causal/Physical Determinism': [],
    'Logical Determinism/Fatalism': ['The Principle of Bivalence', 'The Conditional', 'The Conclusion', 'Aristotle\'s Sea Battle Argument'],
    'The Principle of Bivalence': [],
    'The Conditional': [],
    'The Conclusion': [],
    'Aristotle\'s Sea Battle Argument': [],
    'Theological Determinism': [],
    'Indeterminism': [],
    'Libertarianism': [],
    'Responsibility': [],
    'Metaphysics of Modality': ['Contingent vs. Necessary'],
    'Contingent vs. Necessary': ['Contingent', 'Necessary'],
    'Contingent': ['Intuitive Appeal of Contingency'],
    'Intuitive Appeal of Contingency': [],
    'Necessary': ['Global Necessitarianism'],
    'Global Necessitarianism': ['Strong Determinism', 'Spinoza\'s Necessitarianism'],
    'Strong Determinism': [],
    'Spinoza\'s Necessitarianism': [],
    'Ontology': ['Aristotle\'s Substance Ontology', 'Being', 'Categories', 'Existence vs. Essence', 'Properties', 'Relationality', 'Relations', 'The Problem of the One and the Many', 'Universals', 'Why is there something rather than nothing?'],
    'Aristotle\'s Substance Ontology': ['The 10 Categories of Being'],
    'The 10 Categories of Being': ['Substance', 'Non-Substance Categories'],

    'Substance': ['Fundamental/Primacy', 'Independent and Self-Sufficient', 'Self-Subsistent', 'Individual', 'Types of Substance', 'Persistent Through Accidental Change', 'Change'],
    'Fundamental/Primacy': [],
    'Independent and Self-Sufficient': [],
    'Self-Subsistent': [],
    'Individual': [],
    'Types of Substance': ['Primary Substance', 'Secondary Substance'],
    'Primary Substance': [],
    'Secondary Substance': [],
    'Persistent Through Accidental Change': [],
    'Change': ['Four Causes'],
    'Four Causes': ['Material Cause', 'Formal Cause', 'Efficient Cause', 'Final Cause'],
    'Material Cause': [],
    'Formal Cause': [],
    'Efficient Cause': [],
    'Final Cause': [],

    'Non-Substance Categories': ['Quantity', 'Quality', 'Relation', 'Place', 'Time (When)', 'Position', 'Having/State', 'Action', 'Passion'],
    'Quantity': [],
    'Quality': [],
    'Relation': [],
    'Place': [],
    'Time (When)': [],
    'Position': [],
    'Having/State': [],
    'Action': [],
    'Passion': [],
    'Being': [],
    'Categories': [],
    'Existence vs. Essence': ['Existence', 'Essence', 'Aquinas\'s Existential Distinction', 'Sartre\'s Existence Precedes Essence'],
    'Existence': [],
    'Essence': [],
    'Aquinas\'s Existential Distinction': ['In Created Beings', 'In God'],
    'In Created Beings': [],
    'In God': [],
    'Sartre\'s Existence Precedes Essence': [],
    'Platonic Dualism': ['Realm of Forms', 'The Realm of Sensible Particulars'],
    'Realm of Forms': ['The Form of the Good (Agathon)', 'Higher-Level Forms'],
    'The Form of the Good (Agathon)': [],
    'Higher-Level Forms': ['The Form of Justice', 'The Form of Beauty', 'The Form of Courage', 'The Form of Piety'],
    'The Form of Justice': [],
    'The Form of Beauty': [],
    'The Form of Courage': [],
    'The Form of Piety': [],
    'The Realm of Sensible Particulars': [],
    'Properties': [],
    'Relationality': ['Types of Relations', 'Relationalism', 'Nature of Relations', 'Relational Identity', 'Relata', 'Relational Properties'],
    'Types of Relations': ['Causal Relations', 'Spatial Relations', 'Temporal Relations'],
    'Causal Relations': [],
    'Spatial Relations': [],
    'Temporal Relations': [],
    'Relationalism': ['Vervaeke\'s Pure Relationality', 'Whitehead\'s Process Ontology'],
    'Vervaeke\'s Pure Relationality': [],
    'Nature of Relations': ['Internal Relations', 'External Relations'],
    'Internal Relations': [],
    'External Relations': [],
    'Relational Identity': [],
    'Relata': [],
    'Relational Properties': [],
    'Relations': [],
    'The Problem of the One and the Many': ['Platonic Dualism'],
    'Universals': [],
    'Whitehead\'s Process Ontology': [],
    'Why is there something rather than nothing?': ['Pearce\'s Zero Ontology'],
    'Pearce\'s Zero Ontology': ['Criticism of Pearce\'s Zero Ontology'],
    'Criticism of Pearce\'s Zero Ontology': [],
    'Philosophy of Mind': ['Artificial Intelligence', 'Consciousness', 'Intentionality', 'Personal Identity', 'Philosophy of Cognition', 'Qualia', 'The Mind-Body Problem'],
    'Artificial Intelligence': [],
    'Consciousness': [],
    'Intentionality': [],
    'Personal Identity': [],
    'Philosophy of Cognition': ['Computationalism', 'Conceptualism'],
    'Computationalism': ['Limits of Computationalism'],
    'Limits of Computationalism': ['Vervaeke\'s Relevance Realization'],
    'Vervaeke\'s Relevance Realization': [],
    'Conceptualism': ['Ockham\'s Conceptualism'],
    'Ockham\'s Conceptualism': [],
    'Qualia': [],
    'The Mind-Body Problem': ['Dualism'],
    'Dualism': ['Cartesian Substance Dualism'],
    'Cartesian Substance Dualism': ['Mind', 'Body', 'How do the two Substances causally interact?', 'Argument from Doubt', 'Argument from Divisibility', 'Argument from Clear and Distinct Perception'],
    'Mind': [],
    'Body': [],
    'How do the two Substances causally interact?': [],
    'Argument from Doubt': [],
    'Argument from Divisibility': [],
    'Argument from Clear and Distinct Perception': [],
    'Substance Theory': [],
    'Time': [],
    
    // Epistemology
    'Epistemology': ['Sources of Knowledge', 'The Nature of Knowledge'],
    'Sources of Knowledge': ['Empiricism', 'Memory', 'Perception', 'Rationalism', 'Testimony'],
    'Empiricism': [],
    'Rationalism': [],
    'Testimony': [],
    'Memory': [],
    'Perception': [],
    'The Nature of Knowledge': ['Belief', 'Intelligibility', 'Skepticism', 'The Justified True Belief Account of Knowledge', 'Truth'],
    'Belief': [],
    'Skepticism': [],
    'Truth': ['Coherence Theory', 'Correspondence Theory', 'Deflationism', 'Pluralism', 'Pragmatism', 'Relativism'],
    'Coherence Theory': [],
    'Correspondence Theory': [],
    'Deflationism': [],
    'Pluralism': [],
    'Pragmatism': [],
    'Relativism': [],
    'The Justified True Belief Account of Knowledge': ['Acquaintance Knowledge', 'Fallibilism', 'Infallibilism', 'Justification', 'Propositional Knowledge', 'Skill Knowledge', 'The Gettier Problem'],
    'Acquaintance Knowledge': [],
    'Fallibilism': [],
    'Infallibilism': [],
    'Propositional Knowledge': [],
    'Skill Knowledge': [],
    'Justification': ['Coherentism', 'Externalism', 'Foundationalism', 'Internalism'],
    'Internalism': [],
    'Externalism': [],
    'Foundationalism': [],
    'Coherentism': [],
    'The Gettier Problem': ['Examples', 'Gettier Intuition'],
    'Gettier Intuition': [],
    'Examples': ['Goldman\'s Fake Barns', 'Jones and the Ford', 'Smith and Jones', 'The Sheep in the Field', 'The Stopped Clock'],
    'Goldman\'s Fake Barns': [],
    'Jones and the Ford': [],
    'Smith and Jones': [],
    'The Sheep in the Field': [],
    'The Stopped Clock': [],
    'Intelligibility': ['Conceptual', 'Contextual', 'Explanatory', 'Logical', 'Phenomenological'],
    'Conceptual': [],
    'Contextual': [],
    'Explanatory': [],
    'Logical': [],
    'Phenomenological': [],
    
    // Logic
    'Logic': ['Formal Logic', 'Symbolic Logic', 'Reasoning', 'Fallacies', 'Set Theory', 'Model Theory'],
    'Formal Logic': ['Propositional Logic', 'Predicate Logic', 'Modal Logic', 'Temporal Logic', 'Fuzzy Logic', 'Paraconsistent Logic'],
    'Propositional Logic': [],
    'Predicate Logic': [],
    'Modal Logic': [],
    'Temporal Logic': [],
    'Fuzzy Logic': [],
    'Paraconsistent Logic': [],
    'Symbolic Logic': [],
    'Reasoning': [],
    'Fallacies': [],
    'Set Theory': [],
    'Model Theory': [],
    
    // Aesthetics
    'Aesthetics': ['Beauty', 'Art Theory', 'Taste', 'Sublime', 'Expression Theory'],
    'Beauty': ['Classical Beauty', 'Kant on Beauty', 'Aesthetic Experience', 'Form and Content', 'Subjective Beauty', 'Objective Beauty'],
    'Classical Beauty': [],
    'Kant on Beauty': [],
    'Aesthetic Experience': [],
    'Form and Content': [],
    'Subjective Beauty': [],
    'Objective Beauty': [],
    'Art Theory': ['Representationalism', 'Formalism', 'Expressionism', 'Conceptual Art', 'Aestheticism', 'Institutional Theory'],
    'Representationalism': [],
    'Formalism': [],
    'Expressionism': [],
    'Conceptual Art': [],
    'Aestheticism': [],
    'Institutional Theory': [],
    'Taste': [],
    'Sublime': [],
    'Expression Theory': [],
    
    // Political Philosophy
    'Political Philosophy': ['Rights', 'Democracy', 'Authoritarianism', 'Anarchism', 'Libertarianism'],
    
    // History of Philosophy
    'History of Philosophy': [
      'Vedic Indian Philosophy (16th c BC - 6th c BC)',
      'Classical Chinese Philosophy (6th c BC - 3rd c BC)',
      'Ancient Western Philosophy (6th c BC - 5th c AD)',
      'Classical Indian Philosophy (6th c BC - 11th c AD)',
      'Imperial Chinese Philosophy (3rd c BC - 20th c AD)',
      'Medieval Western Philosophy (5th c - 15th c)',
      'Golden Age Islamic Philosophy (8th c - 13th c)',
      'Medieval Indian Philosophy (8th c - 18th c)',
      'Post-Classical Islamic Philosophy (13th c - 19th c)',
      'Western Renaissance Philosophy (15th c - 16th c)',
      'Early Modern Western Philosophy (17th c - 18th c)',
      'Edo Japanese Philosophy (1603-1868)',
      'Late Modern Western Philosophy (19th c)',
      'Modern Indian Philosophy (19th c - 21st c)',
      'Modern Japanese Philosophy (19th c - 21st c)',
      'Modern Chinese Philosophy (20th c - 21st c)',
      'Modern Islamic Philosophy (20th c - 21st c)',
      'Modern African Philosophy (20th c - 21st c)',
      'Contemporary Western Philosophy (19th c - 21st c)',
    ],

    // Vedic Indian Philosophy
    'Vedic Indian Philosophy (16th c BC - 6th c BC)': ['Vyasa (1500 BC)', 'Yajnavalkya (8th c BC)', 'Kapila (7th c BC)', 'Gautama (6th c BC)', 'Kanada (6th c BC)', 'Jaimini (6th c BC)', 'Adi Shankara (788 AD - 820 AD)'],
    'Vyasa (1500 BC)': [],
    'Yajnavalkya (8th c BC)': [],
    'Kapila (7th c BC)': [],
    'Gautama (6th c BC)': [],
    'Kanada (6th c BC)': [],
    'Jaimini (6th c BC)': [],
    'Adi Shankara (788 AD - 820 AD)': [],

    // Classical Chinese Philosophy
    'Classical Chinese Philosophy (6th c BC - 3rd c BC)': ['Daoism (6th c BC - present)', 'Confucianism (551 BC - present)', 'Legalism (4th c BC - 3rd c BC)'],
    'Confucianism (551 BC - present)': ['Confucius (Kong Fuzi) (551 BC - 479 BC)', 'Mencius (Mengzi) (372 BC - 289 BC)', 'Xunzi (Xun Kuang) (3rd c BC)', 'Dong Zhongshu (179 BC - 104 BC)'],
    'Confucius (Kong Fuzi) (551 BC - 479 BC)': [],
    'Mencius (Mengzi) (372 BC - 289 BC)': [],
    'Xunzi (Xun Kuang) (3rd c BC)': [],
    'Dong Zhongshu (179 BC - 104 BC)': [],
    'Daoism (6th c BC - present)': ['Laozi (Lao Tzu) (6th c BC)', 'Zhuangzi (Chuang Tzu) (369 BC - 286 BC)'],
    'Laozi (Lao Tzu) (6th c BC)': [],
    'Zhuangzi (Chuang Tzu) (369 BC - 286 BC)': [],
    'Legalism (4th c BC - 3rd c BC)': ['Shang Yang (390 BC - 338 BC)', 'Hanfeizi (Han Fei) (280 BC - 233 BC)', 'Li Si (280 BC - 208 BC)'],
    'Shang Yang (390 BC - 338 BC)': [],
    'Hanfeizi (Han Fei) (280 BC - 233 BC)': [],
    'Li Si (280 BC - 208 BC)': [],

    // Ancient Western Philosophy
    'Ancient Western Philosophy (6th c BC - 5th c AD)': ['Ancient Greek Philosophy (6th c BC - 1st c BC)', 'Roman Philosophy (1st c AD - 5th c)', 'Late Antiquity (1st c AD - 6th c AD)'],
    'Ancient Greek Philosophy (6th c BC - 1st c BC)': ['Pre-Socratic Philosophy (6th c BC - 5th c BC)', 'Classical Greek Philosophy (5th c BC - 4th c BC)', 'Hellenistic Philosophy (3rd c BC - 1st c BC)'],
    'Pre-Socratic Philosophy (6th c BC - 5th c BC)': ['Milesian School/Ionian School (6th c BC)', 'Italian School (6th c BC - 5th c BC)', 'Heraclitus of Ephesus (535 BC - 475 BC)', 'Pluralists (5th c BC)', 'Atomists (5th c BC)'],
    'Milesian School/Ionian School (6th c BC)': ['Thales of Miletus (~624 BC - ~545 BC)', 'Anaximander of Miletus (610 BC - 546 BC)', 'Anaximenes of Miletus (545 BC)'],
    'Thales of Miletus (~624 BC - ~545 BC)': [],
    'Anaximander of Miletus (610 BC - 546 BC)': [],
    'Anaximenes of Miletus (545 BC)': [],
    'Italian School (6th c BC - 5th c BC)': ['Pythagorean School (6th - 5th c BC)', 'Xenophanes (~565 BC - 478 BC)', 'Eleatic School (5th c BC)'],
    'Pythagorean School (6th - 5th c BC)': ['Pythagoras of Samos (570 BC - 495 BC)'],
    'Pythagoras of Samos (570 BC - 495 BC)': [],
    'Xenophanes (~565 BC - 478 BC)': [],
    'Eleatic School (5th c BC)': ['Parmenides of Elea (515 BC)', 'Zeno of Elea (495 BC - 430 BC)'],
    'Parmenides of Elea (515 BC)': [],
    'Zeno of Elea (495 BC - 430 BC)': [],
    'Pluralists (5th c BC)': ['Anaxagoras of Clazomenae (500 BC - 428 BC)', 'Empedocles of Acragas (494 BC - 434 BC)'],
    'Anaxagoras of Clazomenae (500 BC - 428 BC)': [],
    'Empedocles of Acragas (494 BC - 434 BC)': [],
    'Atomists (5th c BC)': ['Leucippus (480 BC - 420 BC)', 'Democritus of Abdera (460 BC - 370 BC)'],
    'Leucippus (480 BC - 420 BC)': [],
    'Democritus of Abdera (460 BC - 370 BC)': [],
    'Heraclitus of Ephesus (535 BC - 475 BC)': [],
    'Classical Greek Philosophy (5th c BC - 4th c BC)': ['Sophists (5th c BC - 4th c BC)', 'Socrates (469 BC - 399 BC)', 'Plato (~428 BC - ~347 BC)', 'Aristotle (384 BC - 322 BC)'],
    'Sophists (5th c BC - 4th c BC)': ['Protagoras (490 BC - 420 BC)', 'Gorgias (485 BC - 380 BC)'],
    'Protagoras (490 BC - 420 BC)': [],
    'Gorgias (485 BC - 380 BC)': [],
    'Socrates (469 BC - 399 BC)': [],
    'Plato (~428 BC - ~347 BC)': [],
    'Aristotle (384 BC - 322 BC)': [],
    'Hellenistic Philosophy (3rd c BC - 1st c BC)': ['Skepticism (4th c BC - 3rd c AD)', 'The Cynics (4th c BC - 4th c AD)', 'Epicureanism (306 BC - present)', 'Stoicism (300 BC - present)'],
    'Skepticism (4th c BC - 3rd c AD)': ['Pyrrhonism (360 BC - present)'],
    'Pyrrhonism (360 BC - present)': ['Pyrrho of Elis (360 BC - 270 BC)', 'Timon of Phlius (320 BC - 230 BC)', 'Aenesidemus (1st c BC)', 'Sextus Empiricus (2nd c AD - 3rd c AD)'],
    'Pyrrho of Elis (360 BC - 270 BC)': [],
    'Timon of Phlius (320 BC - 230 BC)': [],
    'Aenesidemus (1st c BC)': [],
    'Sextus Empiricus (2nd c AD - 3rd c AD)': [],
    'Epicureanism (306 BC - present)': ['Epicurus (341 BC - 270 BC)', 'Metrodorus of Lampsacus (331 BC - 278 BC)', 'Hermarchus of Mytilene (3rd c BC)'],
    'Epicurus (341 BC - 270 BC)': [],
    'Metrodorus of Lampsacus (331 BC - 278 BC)': [],
    'Hermarchus of Mytilene (3rd c BC)': [],
    'The Cynics (4th c BC - 4th c AD)': ['Antisthenes (445 BC - 365 BC)', 'Diogenes of Sinope (~407 BC - ~322 BC)', 'Crates of Thebes (3rd c BC)'],
    'Antisthenes (445 BC - 365 BC)': [],
    'Diogenes of Sinope (~407 BC - ~322 BC)': [],
    'Crates of Thebes (3rd c BC)': [],
    'Stoicism (300 BC - present)': ['Early Stoa (300 BC - 2nd c BC)', 'Middle Stoa (2nd c BC - 1st c AD)', 'Late Stoa/Roman Stoicism (1st c AD - 2nd c AD)'],
    'Early Stoa (300 BC - 2nd c BC)': ['Zeno of Citium (334 BC - 262 BC)', 'Cleanthes of Assos (330 BC - 230 BC)', 'Chrysippus of Soli (280 BC - 207 BC)'],
    'Zeno of Citium (334 BC - 262 BC)': [],
    'Cleanthes of Assos (330 BC - 230 BC)': [],
    'Chrysippus of Soli (280 BC - 207 BC)': [],
    'Middle Stoa (2nd c BC - 1st c AD)': ['Panaetius of Rhodes (185 BC - 110 BC)', 'Posidonius of Apameia (135 BC - 51 BC)'],
    'Panaetius of Rhodes (185 BC - 110 BC)': [],
    'Posidonius of Apameia (135 BC - 51 BC)': [],
    'Late Stoa/Roman Stoicism (1st c AD - 2nd c AD)': ['Seneca the Younger (4 BC - 65 AD)', 'Epictetus (50 AD - 135 AD)', 'Marcus Aurelius (121 AD - 180 AD)'],
    'Seneca the Younger (4 BC - 65 AD)': [],
    'Epictetus (50 AD - 135 AD)': [],
    'Marcus Aurelius (121 AD - 180 AD)': [],
    'Roman Philosophy (1st c AD - 5th c)': ['Cicero (Marcus Tullius Cicero) (106 BC - 43 BC)', 'Lucretius (Titus Lucretius Carus) (c. 99 BC - c. 55 BC)'],
    'Cicero (Marcus Tullius Cicero) (106 BC - 43 BC)': [],
    'Lucretius (Titus Lucretius Carus) (c. 99 BC - c. 55 BC)': [],
    'Late Antiquity (1st c AD - 6th c AD)': ['Imperial Philosophy (27 BC - 6th c AD)', 'Early Christian Philosophy (150 AD - 500 AD)', 'Late Neoplatonism (350 AD - 500 AD)', 'The Transition to Medieval Philosophy (500 AD - 800 AD)'],
    'Imperial Philosophy (27 BC - 6th c AD)': ['Neoplatonism (3rd c AD - 6th c AD)'],
    'Neoplatonism (3rd c AD - 6th c AD)': ['Plotinus (~204 AD - 270 AD)', 'Porphyry (234 AD - 305 AD)', 'Iamblichus (245 AD - 325 AD)', 'Hypatia of Alexandria (360 AD - 415 AD)', 'Proclus (412 AD - 485 AD)'],
    'Plotinus (~204 AD - 270 AD)': [],
    'Porphyry (234 AD - 305 AD)': [],
    'Iamblichus (245 AD - 325 AD)': [],
    'Hypatia of Alexandria (360 AD - 415 AD)': [],
    'Proclus (412 AD - 485 AD)': [],
    'Early Christian Philosophy (150 AD - 500 AD)': ['The Apostle Paul (1st c AD - ~67 AD)', 'Justin Martyr (~100 AD - 165 AD)', 'Irenaeus of Lyons (2nd c AD)', 'Clement of Alexandria (150 AD - ~216 AD)', 'Tertullian (~155 AD - 220 AD)', 'Origen of Alexandria (185 AD - 254 AD)', 'Augustine of Hippo/Saint Augustine (354 AD - 430 AD)'],
    'The Apostle Paul (1st c AD - ~67 AD)': [],
    'Justin Martyr (~100 AD - 165 AD)': [],
    'Irenaeus of Lyons (2nd c AD)': [],
    'Clement of Alexandria (150 AD - ~216 AD)': [],
    'Tertullian (~155 AD - 220 AD)': [],
    'Origen of Alexandria (185 AD - 254 AD)': [],
    'Augustine of Hippo/Saint Augustine (354 AD - 430 AD)': [],
    'Late Neoplatonism (350 AD - 500 AD)': ['Proclus (412 AD - 485 AD)', 'Damascius (480-550)', 'Simplicius of Cilicia (490-560)', 'Olympiodorus the Younger (5th c - 6th c)'],
    'Damascius (480-550)': [],
    'Simplicius of Cilicia (490-560)': [],
    'Olympiodorus the Younger (5th c - 6th c)': [],
    'The Transition to Medieval Philosophy (500 AD - 800 AD)': ['Boethius (Anicius Manlius Severinus Boethius) (480-~525)', 'Cassiodorus (485-585)', 'John Philoponus (490-570)', 'Pseudo-Dionysius the Areopagite (5th c - 6th c)', 'Isidore of Seville (560-636)'],
    'Boethius (Anicius Manlius Severinus Boethius) (480-~525)': [],
    'Cassiodorus (485-585)': [],
    'John Philoponus (490-570)': [],
    'Pseudo-Dionysius the Areopagite (5th c - 6th c)': [],
    'Isidore of Seville (560-636)': [],

    // Classical Indian Philosophy
    'Classical Indian Philosophy (6th c BC - 11th c AD)': ['Jainism (8th c BC - present)', 'Indian Buddhism (6th c BC - present)'],
    'Jainism (8th c BC - present)': ['Rishabhanatha (an eternity away in the past)', 'Parshvanatha (8th c BC - 7th c BC)', 'Mahavira (599 BC - 527 BC)'],
    'Rishabhanatha (an eternity away in the past)': [],
    'Parshvanatha (8th c BC - 7th c BC)': [],
    'Mahavira (599 BC - 527 BC)': [],
    'Indian Buddhism (6th c BC - present)': ['Siddhartha Gautama (the Buddha) (6th c BC - 4th c BC)', 'Emperor Ashoka (268 BC - 232 BC)', 'Nagarjuna (150 AD - 250 AD)', 'Vasubandhu (4th c AD)', 'Dignāga (5th c AD)'],
    'Siddhartha Gautama (the Buddha) (6th c BC - 4th c BC)': [],
    'Emperor Ashoka (268 BC - 232 BC)': [],
    'Nagarjuna (150 AD - 250 AD)': [],
    'Vasubandhu (4th c AD)': [],
    'Dignāga (5th c AD)': [],

    // Imperial Chinese Philosophy
    'Imperial Chinese Philosophy (3rd c BC - 20th c AD)': ['Chinese Buddhism (1st c AD - present)', 'Neo-Confucianism (960 - present)'],
    'Neo-Confucianism (960 - present)': ['Han Yu (768-824)', 'Zhou Dunyi (1017-1073)', 'Zhang Zai (1020-1077)', 'Cheng Hao (1032-1085)', 'Cheng Yi (1033-1107)', 'Zhu Xi (1130-1200)', 'Wang Yangming (1472-1529)'],
    'Han Yu (768-824)': [],
    'Zhou Dunyi (1017-1073)': [],
    'Zhang Zai (1020-1077)': [],
    'Cheng Hao (1032-1085)': [],
    'Cheng Yi (1033-1107)': [],
    'Zhu Xi (1130-1200)': [],
    'Wang Yangming (1472-1529)': [],
    'Chinese Buddhism (1st c AD - present)': ['An Shigao (2nd c AD)', 'Kumārajiva (344-413)', 'Tanluan (476-542)', 'Bodhidharma (5th c - 6th c)', 'Zhiyi (538-597)', 'Xuanzang (602-664)', 'Hui Neng (638-713)', 'Fazang (643-712)', 'Wang Wei (701-761)'],
    'An Shigao (2nd c AD)': [],
    'Kumārajiva (344-413)': [],
    'Tanluan (476-542)': [],
    'Bodhidharma (5th c - 6th c)': [],
    'Zhiyi (538-597)': [],
    'Xuanzang (602-664)': [],
    'Hui Neng (638-713)': [],
    'Fazang (643-712)': [],
    'Wang Wei (701-761)': [],

    // Medieval Western Philosophy
    'Medieval Western Philosophy (5th c - 15th c)': ['Early Medieval (5th c - 11th c)', 'Scholasticism (11th c - 17th c)'],
    'Early Medieval (5th c - 11th c)': ['John Scotus Eriugena (810-877)'],
    'John Scotus Eriugena (810-877)': [],
    'Scholasticism (11th c - 17th c)': ['Nominalism (11th c - 21st c)', 'Thomism (13th c - 21st c)', 'Scotism (13th c - 21st c)'],
    'Nominalism (11th c - 21st c)': ['Roscellinus (1050-1125)', 'Peter Abelard (1079-1142)', 'William of Ockham (1287-1347)', 'Thomas Hobbes (1588-1679)', 'Pierre Gassendi (1592-1655)', 'Nelson Goodman (1906-1998)'],
    'Roscellinus (1050-1125)': [],
    'Peter Abelard (1079-1142)': [],
    'William of Ockham (1287-1347)': [],
    'Thomas Hobbes (1588-1679)': [],
    'Pierre Gassendi (1592-1655)': [],
    'Nelson Goodman (1906-1998)': [],
    'Thomism (13th c - 21st c)': ['St. Thomas Aquinas (1225-1274)', 'Cardinal Cajetan (1469-1534)', 'Francisco Suárez (1548-1617)', 'Karl Rahner (1904-1984)', 'Neo-Thomism (19th c - present)'],
    'St. Thomas Aquinas (1225-1274)': [],
    'Cardinal Cajetan (1469-1534)': [],
    'Francisco Suárez (1548-1617)': [],
    'Karl Rahner (1904-1984)': [],
    'Neo-Thomism (19th c - present)': ['Pope Leo XIII (1810-1903)', 'Jacques Maritain (1882-1973)', 'Étienne Gilson (1884-1978)', 'Edith Stein (1891-1942)'],
    'Pope Leo XIII (1810-1903)': [],
    'Jacques Maritain (1882-1973)': [],
    'Étienne Gilson (1884-1978)': [],
    'Edith Stein (1891-1942)': [],
    'Scotism (13th c - 21st c)': ['John Duns Scotus (~1265-1308)', 'Francis of Meyronne (1280-1328)'],
    'John Duns Scotus (~1265-1308)': [],
    'Francis of Meyronne (1280-1328)': [],

    // Golden Age Islamic Philosophy
    'Golden Age Islamic Philosophy (8th c - 13th c)': ['Al-Kindi (801-873)', 'Al-Farabi (872-950)', 'Avicenna (Ibn Sina) (980-1037)', 'Al-Ghazali (1058-1111)', 'Ibn Bajjah (Avempace) (1085-1138)', 'Ibn Tufail (1105-1185)', 'Ibn Rushd (Averroes) (1126-1198)'],
    'Al-Kindi (801-873)': [],
    'Al-Farabi (872-950)': [],
    'Avicenna (Ibn Sina) (980-1037)': [],
    'Al-Ghazali (1058-1111)': [],
    'Ibn Bajjah (Avempace) (1085-1138)': [],
    'Ibn Tufail (1105-1185)': [],
    'Ibn Rushd (Averroes) (1126-1198)': [],

    // Medieval Indian Philosophy
    'Medieval Indian Philosophy (8th c - 18th c)': ['Vedanta Schools (8th c - present)', 'Nyaya and Vaisheshika (10th c - present)', 'Basava (1131-1167)', 'Gangesha Upadhyaya (13th c - 14th c)'],
    'Vedanta Schools (8th c - present)': ['Adi Shankara (788 AD - 820 AD)', 'Ramanuja (1017-1137)', 'Madhvacharya (1238-1317)', 'Vallabhacharya (1479-1531)'],
    'Ramanuja (1017-1137)': [],
    'Madhvacharya (1238-1317)': [],
    'Vallabhacharya (1479-1531)': [],
    'Nyaya and Vaisheshika (10th c - present)': ['Udayana (10th c - 11th c)'],
    'Udayana (10th c - 11th c)': [],
    'Basava (1131-1167)': [],
    'Gangesha Upadhyaya (13th c - 14th c)': [],

    // Post-Classical Islamic Philosophy
    'Post-Classical Islamic Philosophy (13th c - 19th c)': ['Fakhr al-Din al-Razi (1149-1209)', 'Suhrawardi (1155-1191)', 'Ibn Arabi (1165-1240)', 'Nasir al-Din al-Tusi (1201-1274)', 'Ibn Khaldun (1332-1406)', 'Mulla Sadra (1572-1640)'],
    'Fakhr al-Din al-Razi (1149-1209)': [],
    'Suhrawardi (1155-1191)': [],
    'Ibn Arabi (1165-1240)': [],
    'Nasir al-Din al-Tusi (1201-1274)': [],
    'Ibn Khaldun (1332-1406)': [],
    'Mulla Sadra (1572-1640)': [],

    // Western Renaissance Philosophy
    'Western Renaissance Philosophy (15th c - 16th c)': ['Marsilio Ficino (1433-1499)', 'Giovanni Pico della Mirandola (1463-1494)', 'Erasmus of Rotterdam (1466-1536)', 'Niccolò Machiavelli (1469-1527)', 'Nicolaus Copernicus (1473-1543)', 'Michel de Montaigne (1533-1592)', 'Giordano Bruno (1548-1600)'],
    'Marsilio Ficino (1433-1499)': [],
    'Giovanni Pico della Mirandola (1463-1494)': [],
    'Erasmus of Rotterdam (1466-1536)': [],
    'Niccolò Machiavelli (1469-1527)': [],
    'Nicolaus Copernicus (1473-1543)': [],
    'Michel de Montaigne (1533-1592)': [],
    'Giordano Bruno (1548-1600)': [],

    // Early Modern Western Philosophy
    'Early Modern Western Philosophy (17th c - 18th c)': ['Continental Rationalism (17th c)', 'British Empiricism (17th c - 18th c)', 'The Enlightenment (18th c)', 'Scottish Enlightenment (1740-1790)'],
    'Continental Rationalism (17th c)': ['René Descartes (1596-1650)', 'Blaise Pascal (1623-1662)', 'Baruch Spinoza (1632-1677)', 'Gottfried Wilhelm Leibniz (1646-1716)'],
    'René Descartes (1596-1650)': [],
    'Blaise Pascal (1623-1662)': [],
    'Baruch Spinoza (1632-1677)': [],
    'Gottfried Wilhelm Leibniz (1646-1716)': [],
    'British Empiricism (17th c - 18th c)': ['John Locke (1632-1704)', 'George Berkeley (1685-1753)'],
    'John Locke (1632-1704)': [],
    'George Berkeley (1685-1753)': [],
    'The Enlightenment (18th c)': ['Montesquieu (Charles-Louis de Secondat, baron de Montesquieu) (1689-1755)', 'Voltaire (François-Marie Arouet) (1694-1778)', 'Jean-Jacques Rousseau (1712-1778)', 'Denis Diderot (1713-1784)', 'Thomas Jefferson (1743-1826)', 'Mary Wollstonecraft (1759-1797)'],
    'Montesquieu (Charles-Louis de Secondat, baron de Montesquieu) (1689-1755)': [],
    'Voltaire (François-Marie Arouet) (1694-1778)': [],
    'Jean-Jacques Rousseau (1712-1778)': [],
    'Denis Diderot (1713-1784)': [],
    'Thomas Jefferson (1743-1826)': [],
    'Mary Wollstonecraft (1759-1797)': [],
    'Scottish Enlightenment (1740-1790)': ['Scottish Empiricism (18th c)', 'Scottish Common Sense Realism (18th c - 19th c)', 'Scottish Moral Philosophy (18th c - 19th c)'],
    'Scottish Empiricism (18th c)': ['David Hume (1711-1776)'],
    'David Hume (1711-1776)': [],
    'Scottish Common Sense Realism (18th c - 19th c)': ['Thomas Reid (1710-1796)', 'Dugald Stewart (1753-1828)'],
    'Thomas Reid (1710-1796)': [],
    'Dugald Stewart (1753-1828)': [],
    'Scottish Moral Philosophy (18th c - 19th c)': ['Francis Hutcheson (1694-1746)', 'Adam Smith (1723-1790)', 'Adam Ferguson (1723-1816)', 'Thomas Brown (1778-1820)'],
    'Francis Hutcheson (1694-1746)': [],
    'Adam Smith (1723-1790)': [],
    'Adam Ferguson (1723-1816)': [],
    'Thomas Brown (1778-1820)': [],

    // Edo Japanese Philosophy
    'Edo Japanese Philosophy (1603-1868)': ['Fujiwara Seika (1561-1619)', 'Hayashi Razan (1583-1657)', 'Itō Jinsai (1627-1705)', 'Kaibara Ekiken (1630-1714)', 'Ogyū Sorai (1666-1728)', 'Andō Shōeki (1703-1762)', 'Miura Baien (1723-1789)', 'Motoori Norinaga (1730-1801)'],
    'Fujiwara Seika (1561-1619)': [],
    'Hayashi Razan (1583-1657)': [],
    'Itō Jinsai (1627-1705)': [],
    'Kaibara Ekiken (1630-1714)': [],
    'Ogyū Sorai (1666-1728)': [],
    'Andō Shōeki (1703-1762)': [],
    'Miura Baien (1723-1789)': [],
    'Motoori Norinaga (1730-1801)': [],

    // Late Modern Western Philosophy
    'Late Modern Western Philosophy (19th c)': ['Utilitarianism (18th c - present)', 'German Idealism (1780\'s - 1840s)', 'Pessimism (19th c)', 'Anthropological Materialism (19th c)', 'Existentialism (19th c - present)', 'Transcendentalism (1830s-1860s)', 'Depth Psychology/Analytical Psychology/Psychology of Religion (1880-1970)'],
    'German Idealism (1780\'s - 1840s)': ['Immanuel Kant (1724-1804)', 'Johann Gottlieb Fichte (1762-1814)', 'Georg Wilhelm Friedrich Hegel (1770-1831)', 'Friedrich Hölderlin (1770-1843)', 'Friedrich Wilhelm Joseph Schelling (1775-1854)'],
    'Immanuel Kant (1724-1804)': [],
    'Johann Gottlieb Fichte (1762-1814)': [],
    'Georg Wilhelm Friedrich Hegel (1770-1831)': [],
    'Friedrich Hölderlin (1770-1843)': [],
    'Friedrich Wilhelm Joseph Schelling (1775-1854)': [],
    'Utilitarianism (18th c - present)': ['Jeremy Bentham (1748-1832)', 'John Stuart Mill (1806-1873)', 'Henry Sidgwick (1838-1900)', 'R.M. Hare (1919-2002)', 'Peter Singer (1946-present)'],
    'Jeremy Bentham (1748-1832)': [],
    'John Stuart Mill (1806-1873)': [],
    'Henry Sidgwick (1838-1900)': [],
    'R.M. Hare (1919-2002)': [],
    'Peter Singer (1946-present)': [],
    'Anthropological Materialism (19th c)': ['Ludwig Feuerbach (1804-1872)', 'Marxism (1818-present)'],
    'Ludwig Feuerbach (1804-1872)': [],
    'Marxism (1818-present)': ['Karl Marx (1818-1883)', 'Friedrich Engels (1820-1895)', 'Vladimir Lenin (1870-1924)', 'Rosa Luxemburg (1871-1919)', 'Leon Trotsky (1879-1940)', 'Antonio Gramsci (1891-1937)', 'Mao Zedong (1893-1976)'],
    'Karl Marx (1818-1883)': [],
    'Friedrich Engels (1820-1895)': [],
    'Vladimir Lenin (1870-1924)': [],
    'Rosa Luxemburg (1871-1919)': [],
    'Leon Trotsky (1879-1940)': [],
    'Antonio Gramsci (1891-1937)': [],
    'Mao Zedong (1893-1976)': [],
    'Pessimism (19th c)': ['Arthur Schopenhauer (1788-1860)'],
    'Arthur Schopenhauer (1788-1860)': [],
    'Transcendentalism (1830s-1860s)': ['Henry David Thoreau (1817-1862)'],
    'Henry David Thoreau (1817-1862)': [],
    'Existentialism (19th c - present)': ['Søren Kierkegaard (1813-1855)', 'Friedrich Nietzsche (1844-1900)', 'Karl Jaspers (1883-1969)', 'Gabriel Marcel (1889-1973)', 'Martin Heidegger (1889-1976)', 'Jean-Paul Sartre (1905-1980)', 'Simone de Beauvoir (1908-1986)', 'Absurdism (20th c)'],
    'Søren Kierkegaard (1813-1855)': [],
    'Friedrich Nietzsche (1844-1900)': [],
    'Karl Jaspers (1883-1969)': [],
    'Gabriel Marcel (1889-1973)': [],
    'Martin Heidegger (1889-1976)': [],
    'Jean-Paul Sartre (1905-1980)': [],
    'Simone de Beauvoir (1908-1986)': [],
    'Absurdism (20th c)': ['Albert Camus (1913-1960)'],
    'Albert Camus (1913-1960)': [],
    'Depth Psychology/Analytical Psychology/Psychology of Religion (1880-1970)': ['Sigmund Freud (1856-1939)', 'Alfred Adler (1870-1937)', 'Carl Jung (1875-1961)', 'Ludwig Binswanger (1881-1966)', 'Melanie Klein (1882-1960)', 'Otto Rank (1884-1939)'],
    'Sigmund Freud (1856-1939)': [],
    'Alfred Adler (1870-1937)': [],
    'Carl Jung (1875-1961)': [],
    'Ludwig Binswanger (1881-1966)': [],
    'Melanie Klein (1882-1960)': [],
    'Otto Rank (1884-1939)': [],

    // Modern Indian Philosophy
    'Modern Indian Philosophy (19th c - 21st c)': ['Raja Ram Mohan Roy (1772-1833)', 'Rabindranath Tagore (1861-1941)', 'Swami Vivekananda (1863-1902)', 'Mahatma Gandhi (1869-1948)', 'Sri Aurobindo (1872-1950)', 'Sarvepalli Radhakrishnan (1888-1975)', 'Dr. B.R. Ambedkar (1891-1956)', 'Jiddu Krishnamurti (1895-1986)'],
    'Raja Ram Mohan Roy (1772-1833)': [],
    'Rabindranath Tagore (1861-1941)': [],
    'Swami Vivekananda (1863-1902)': [],
    'Mahatma Gandhi (1869-1948)': [],
    'Sri Aurobindo (1872-1950)': [],
    'Sarvepalli Radhakrishnan (1888-1975)': [],
    'Dr. B.R. Ambedkar (1891-1956)': [],
    'Jiddu Krishnamurti (1895-1986)': [],

    // Modern Japanese Philosophy
    'Modern Japanese Philosophy (19th c - 21st c)': ['Nishi Amane (1829-1897)', 'Katō Hiroyuki (1836-1916)', 'Nakae Chōmin (1847-1901)', 'Kitarō Nishida (1870-1945)', 'Hajime Tanabe (1885-1962)', 'Watsuji Tetsurō (1889-1960)', 'Keiji Nishitani (1900-1990)'],
    'Nishi Amane (1829-1897)': [],
    'Katō Hiroyuki (1836-1916)': [],
    'Nakae Chōmin (1847-1901)': [],
    'Kitarō Nishida (1870-1945)': [],
    'Hajime Tanabe (1885-1962)': [],
    'Watsuji Tetsurō (1889-1960)': [],
    'Keiji Nishitani (1900-1990)': [],

    // Modern Chinese Philosophy
    'Modern Chinese Philosophy (20th c - 21st c)': ['Kang Youwei (1858-1927)', 'Cai Yuanpei (1868-1940)', 'Liang Qichao (1873-1929)', 'Xiong Shili (1885-1968)', 'Hu Shi (1891-1962)', 'Feng Youlan (1895-1990)', 'Mou Zongsan (1909-1995)', 'Li Zehou (1930-present)'],
    'Kang Youwei (1858-1927)': [],
    'Cai Yuanpei (1868-1940)': [],
    'Liang Qichao (1873-1929)': [],
    'Xiong Shili (1885-1968)': [],
    'Hu Shi (1891-1962)': [],
    'Feng Youlan (1895-1990)': [],
    'Mou Zongsan (1909-1995)': [],
    'Li Zehou (1930-present)': [],

    // Modern Islamic Philosophy
    'Modern Islamic Philosophy (20th c - 21st c)': ['Jamal al-Din al-Afghani (~1838-1897)', 'Muhammad Abduh (1849-1905)', 'Muhammad Iqbal (1877-1938)', 'Sayyid Qutb (1906-1966)', 'Fazlur Rahman (1919-1988)', 'Mohammad Arkoun (1928-2010)', 'Ali Shariati (1933-1977)'],
    'Jamal al-Din al-Afghani (~1838-1897)': [],
    'Muhammad Abduh (1849-1905)': [],
    'Muhammad Iqbal (1877-1938)': [],
    'Sayyid Qutb (1906-1966)': [],
    'Fazlur Rahman (1919-1988)': [],
    'Mohammad Arkoun (1928-2010)': [],
    'Ali Shariati (1933-1977)': [],

    // Modern African Philosophy
    'Modern African Philosophy (20th c - 21st c)': ['Kwasi Wiredu (1931-2022)', 'Sophie Oluwole (1935-2018)', 'V. Y. Mudimbe (1941-present)', 'Paulin J. Hountondji (1942-present)', 'Kwame Anthony Appiah (1954-present)'],
    'Kwasi Wiredu (1931-2022)': [],
    'Sophie Oluwole (1935-2018)': [],
    'V. Y. Mudimbe (1941-present)': [],
    'Paulin J. Hountondji (1942-present)': [],
    'Kwame Anthony Appiah (1954-present)': [],

    // Contemporary Western Philosophy
    'Contemporary Western Philosophy (19th c - 21st c)': ['Pragmatism (1870s - present)', 'Contemporary Political Philosophy (19th c - 21st c)', 'Analytic Philosophy (1900s - present)', 'Continental Philosophy (1920s - present)', 'Cognitive Philosophical Synthesis (1980s - present)'],
    'Pragmatism (1870s - present)': ['Charles Sanders Peirce (1839-1914)', 'Oliver Wendell Holmes Jr. (1841-1935)', 'William James (1842-1910)', 'John Dewey (1859-1952)', 'George Herbert Mead (1863-1931)'],
    'Charles Sanders Peirce (1839-1914)': [],
    'Oliver Wendell Holmes Jr. (1841-1935)': [],
    'William James (1842-1910)': [],
    'John Dewey (1859-1952)': [],
    'George Herbert Mead (1863-1931)': [],
    'Analytic Philosophy (1900s - present)': ['Gottlob Frege (1848-1925)', 'Alfred North Whitehead (1861-1947)', 'Bertrand Russell (1872-1970)', 'G. E. Moore (1873-1958)', 'Ludwig Wittgenstein (1889-1951)', 'Rudolf Carnap (1891-1970)', 'Willard Van Orman Quine (1908-2000)', 'Saul Kripke (1940-2022)'],
    'Alfred North Whitehead (1861-1947)': [],
    'Gottlob Frege (1848-1925)': [],
    'Bertrand Russell (1872-1970)': [],
    'G. E. Moore (1873-1958)': [],
    'Ludwig Wittgenstein (1889-1951)': [],
    'Rudolf Carnap (1891-1970)': [],
    'Willard Van Orman Quine (1908-2000)': [],
    'Saul Kripke (1940-2022)': [],
    'Contemporary Political Philosophy (19th c - 21st c)': ['Political Realism (20th c - 21st c)', 'American Political Philosophy (20th c)', 'Leo Strauss (1899-1973)', 'Hannah Arendt (1906-1975)'],
    'American Political Philosophy (20th c)': ['Walter Lippmann (1889-1974)', 'John Rawls (1921-2002)', 'Libertarianism (20th c - 21st c)'],
    'Walter Lippmann (1889-1974)': [],
    'John Rawls (1921-2002)': [],
    'Libertarianism (20th c - 21st c)': ['Robert Nozick (1938-2002)'],
    'Robert Nozick (1938-2002)': [],
    'Hannah Arendt (1906-1975)': [],
    'Leo Strauss (1899-1973)': [],
    'Political Realism (20th c - 21st c)': ['Authoritarian Political Realism/Decisionism (20th c)'],
    'Authoritarian Political Realism/Decisionism (20th c)': ['Carl Schmitt (1888-1985)'],
    'Carl Schmitt (1888-1985)': [],
    'Continental Philosophy (1920s - present)': ['Phenomenology (19th c - present)', 'Hans-Georg Gadamer (1900-2002)', 'Critical Theory (1920s-present)', 'Post-structuralism (1960s-present)', 'Postmodernism (1960-present)'],
    'Phenomenology (19th c - present)': ['Edmund Husserl (1859-1938)'],
    'Edmund Husserl (1859-1938)': [],
    'Hans-Georg Gadamer (1900-2002)': [],
    'Critical Theory (1920s-present)': ['Erich Fromm (1900-1980)', 'The Frankfurt School (1923 - present)', 'Slavoj Žižek (1949-present)'],
    'The Frankfurt School (1923 - present)': ['Walter Benjamin (1892-1940)', 'Max Horkheimer (1895-1973)', 'Herbert Marcuse (1898-1979)', 'Theodor W. Adorno (1903-1969)', 'Jürgen Habermas (1929-present)'],
    'Walter Benjamin (1892-1940)': [],
    'Max Horkheimer (1895-1973)': [],
    'Herbert Marcuse (1898-1979)': [],
    'Theodor W. Adorno (1903-1969)': [],
    'Jürgen Habermas (1929-present)': [],
    'Erich Fromm (1900-1980)': [],
    'Slavoj Žižek (1949-present)': [],
    'Postmodernism (1960-present)': ['Jean-François Lyotard (1924-1998)', 'Jean Baudrillard (1929-2007)', 'Félix Guattari (1930-1992)', 'Richard Rorty (1931-2007)'],
    'Jean-François Lyotard (1924-1998)': [],
    'Jean Baudrillard (1929-2007)': [],
    'Félix Guattari (1930-1992)': [],
    'Richard Rorty (1931-2007)': [],
    'Post-structuralism (1960s-present)': ['Jacques Lacan (1901-1981)', 'Roland Barthes (1915-1980)', 'Gilles Deleuze (1925-1995)', 'Michel Foucault (1926-1984)', 'Jacques Derrida (1930-2004)', 'Julia Kristeva (1941-present)'],
    'Jacques Lacan (1901-1981)': [],
    'Roland Barthes (1915-1980)': [],
    'Gilles Deleuze (1925-1995)': [],
    'Michel Foucault (1926-1984)': [],
    'Jacques Derrida (1930-2004)': [],
    'Julia Kristeva (1941-present)': [],
    'Cognitive Philosophical Synthesis (1980s - present)': ['Cognitive Existentialism (1990s - present)'],
    'Cognitive Existentialism (1990s - present)': ['Cognitive Integration and Meaning-Making (1990s - present)'],
    'Cognitive Integration and Meaning-Making (1990s - present)': ['John Vervaeke'],
    'John Vervaeke': [],
    
    // Metaphilosophy
    'Metaphilosophy': ['Experimental Philosophy/x-phi', 'Philosophical Quietism', 'Philosophy of Logic', 'Philosophy of Language', 'Philosophy of Science'],
    'Experimental Philosophy/x-phi': ['Negative Program'],
    'Negative Program': ['Intuition Variability'],
    'Intuition Variability': [],
    'Philosophical Quietism': ['Wittgenstein\'s Philosophical Quietism'],
    'Wittgenstein\'s Philosophical Quietism': [],
    'Philosophy of Logic': [],
    'Philosophy of Language': [],
    'Philosophy of Science': [],
    
    // History
    'History': [
      'Prehistory (3.3 million years ago - 3,200 BC)',
      'Ancient History (3,200 BC - 476 AD)',
      'Medieval Period (476 - 1453)',
      'Modern Era (1453 - present)',
    ],
    'Prehistory (3.3 million years ago - 3,200 BC)': ['Stone Age (3.3 million years ago - 3,300 BC)', 'Early Bronze Age (3,300 BC - 3,200 BC)'],
    'Stone Age (3.3 million years ago - 3,300 BC)': ['Paleolithic Era (3.3 million years ago - 10,000 BC)', 'Mesolithic Era (10,000 BC - 8,000 BC)', 'Neolithic Era (8,000 BC - 4,500 BC)', 'Copper Age (4,500 BC - 3,300 BC)'],

    // Paleolithic Era
    'Paleolithic Era (3.3 million years ago - 10,000 BC)': ['Lower Paleolithic (3.3 million years ago - 300,000 years ago)', 'Middle Paleolithic (300,000 years ago - 40,000 years ago)', 'Upper Paleolithic (40,000 years ago - 10,000 BC)'],
    'Lower Paleolithic (3.3 million years ago - 300,000 years ago)': [],
    'Middle Paleolithic (300,000 years ago - 40,000 years ago)': ['Early Middle Paleolithic (300,000 years ago - 120,000 years ago)', 'Last Glacial Period, Middle Paleolithic (120,000 years ago - 40,000 years ago)'],
    'Early Middle Paleolithic (300,000 years ago - 120,000 years ago)': [],
    'Last Glacial Period, Middle Paleolithic (120,000 years ago - 40,000 years ago)': [],
    'Upper Paleolithic (40,000 years ago - 10,000 BC)': ['Last Glacial Period, Upper Paleolithic (40,000 years ago - 10,000 BC)', 'Younger Dryas Event, Upper Paleolithic (10,875 BC - 10,000 BC)'],
    'Last Glacial Period, Upper Paleolithic (40,000 years ago - 10,000 BC)': [],
    'Younger Dryas Event, Upper Paleolithic (10,875 BC - 10,000 BC)': [],

    // Mesolithic Era
    'Mesolithic Era (10,000 BC - 8,000 BC)': ['Last Glacial Period End, Mesolithic (10,000 BC - 9,675 BC)', 'Late Mesolithic (9,675 BC - 8,000 BC)'],
    'Last Glacial Period End, Mesolithic (10,000 BC - 9,675 BC)': ['Younger Dryas Event, Mesolithic (10,000 BC - 9,675 BC)', 'Younger Dryas End, Late Mesolithic (9,675 BC - 9,575 BC)'],
    'Younger Dryas Event, Mesolithic (10,000 BC - 9,675 BC)': [],
    'Younger Dryas End, Late Mesolithic (9,675 BC - 9,575 BC)': [],
    'Late Mesolithic (9,675 BC - 8,000 BC)': [],

    // Neolithic Era
    'Neolithic Era (8,000 BC - 4,500 BC)': [],

    // Copper Age
    'Copper Age (4,500 BC - 3,300 BC)': ['Sumerian Civilization (4,100 BC - 3,300 BC)', 'Predynastic Egypt (4,100 BC - 3,300 BC)', 'Ebla Civilization (3,500 BC - 3,300 BC)'],
    'Sumerian Civilization (4,100 BC - 3,300 BC)': ['Uruk Period (4,100 BC - 3,300 BC)'],
    'Uruk Period (4,100 BC - 3,300 BC)': [],
    'Predynastic Egypt (4,100 BC - 3,300 BC)': [],
    'Ebla Civilization (3,500 BC - 3,300 BC)': [],

    // Early Bronze Age
    'Early Bronze Age (3,300 BC - 3,200 BC)': ['Indus Valley Civilization (3,300 BC - 3,200 BC)', 'Cycladic Civilization (3,300 BC - 3,200 BC)'],
    'Indus Valley Civilization (3,300 BC - 3,200 BC)': [],
    'Cycladic Civilization (3,300 BC - 3,200 BC)': [],
    'Ancient History (3,200 BC - 476 AD)': ['Ancient Mesopotamia (3,500 BC - 539 BC)', 'Ancient India (3,300 BC - 600 AD)', 'Bronze Age (3,200 BC - 1,200 BC)', 'Ancient Egypt (3,100 BC - 30 BC)', 'Ancient China (2,070 BC - 220 AD)', 'Iron Age (1,200 BC - 600 BC)', 'Classical Antiquity (800 BC - 500 AD)', 'Ancient Greece (800 BC - 146 BC)', 'Ancient Rome (753 BC - 476 AD)', 'Late Antiquity (250 - 500 AD)'],
    'Bronze Age (3,200 BC - 1,200 BC)': ['Early Bronze Age (3,200 BC - 2,000 BC)', 'Middle Bronze Age (2,000 BC - 1,600 BC)', 'Late Bronze Age (1,600 BC - 1,200 BC)'],
    'Early Bronze Age (3,200 BC - 2,000 BC)': ['Helladic Civilization (3,200 BC - 2,000 BC)', 'Ancient Egyptian Civilization (3,100 BC - 2,000 BC)', 'Minoan Civilization (3,100 BC - 2,000 BC)', 'Norte Chico Civilization (3,000 BC - 2,000 BC)', 'Mari Civilization (2,900 BC - 2,000 BC)', 'Elamite Civilization (2,700 BC - 539 BC)', 'Xia Dynasty (2,070 BC - 2,000 BC)'],
    'Helladic Civilization (3,200 BC - 2,000 BC)': [],
    'Ancient Egyptian Civilization (3,100 BC - 2,000 BC)': [],
    'Minoan Civilization (3,100 BC - 2,000 BC)': [],
    'Norte Chico Civilization (3,000 BC - 2,000 BC)': [],
    'Mari Civilization (2,900 BC - 2,000 BC)': [],
    'Elamite Civilization (2,700 BC - 539 BC)': [],
    'Xia Dynasty (2,070 BC - 2,000 BC)': [],
    'Middle Bronze Age (2,000 BC - 1,600 BC)': [],
    'Late Bronze Age (1,600 BC - 1,200 BC)': [],
    'Iron Age (1,200 BC - 600 BC)': ['Early Iron Age (1,200 BC - 1,000 BC)', 'Middle Iron Age (1,000 BC - 800 BC)', 'Late Iron Age (800 BC - 600 BC)'],
    'Early Iron Age (1,200 BC - 1,000 BC)': ['Bronze Age Collapse (1,200 BC - 1,150 BC)'],
    'Bronze Age Collapse (1,200 BC - 1,150 BC)': [],
    'Middle Iron Age (1,000 BC - 800 BC)': [],
    'Late Iron Age (800 BC - 600 BC)': [],
    'Classical Antiquity (800 BC - 500 AD)': [],
    'Late Antiquity (250 - 500 AD)': ['Migration Period (300 - 500 AD)'],
    'Migration Period (300 - 500 AD)': [],
    'Ancient Egypt (3,100 BC - 30 BC)': [],
    'Ancient Mesopotamia (3,500 BC - 539 BC)': [],
    'Ancient India (3,300 BC - 600 AD)': [],
    'Ancient China (2,070 BC - 220 AD)': [],
    'Ancient Greece (800 BC - 146 BC)': [],
    'Ancient Rome (753 BC - 476 AD)': [],
    'Medieval Period (476 - 1453)': ['Early Middle Ages (476 - 1000)', 'High Middle Ages (1000 - 1250)', 'Late Middle Ages (1250 - 1453)', 'Byzantine Empire (330 - 1453)', 'Islamic Golden Age (750 - 1258)'],
    'Early Middle Ages (476 - 1000)': ['Late Antiquity (500 - 750)', 'Migration Period (750 - 800)', 'Carolingian Era (800 - 887)', 'Post-Carolingian Era (887 - 1000)'],
    'Late Antiquity (500 - 750)': ['Migration Period (500 - 750)'],
    'Migration Period (500 - 750)': [],
    'Migration Period (750 - 800)': [],
    'Carolingian Era (800 - 887)': [],
    'Post-Carolingian Era (887 - 1000)': [],
    'High Middle Ages (1000 - 1250)': ['Early High Middle Ages (1000 - 1100)', 'Central High Middle Ages (1100 - 1200)', 'Late High Middle Ages (1201 - 1300)'],
    'Early High Middle Ages (1000 - 1100)': [],
    'Central High Middle Ages (1100 - 1200)': [],
    'Late High Middle Ages (1201 - 1300)': [],
    'Late Middle Ages (1250 - 1453)': [],
    'Byzantine Empire (330 - 1453)': [],
    'Islamic Golden Age (750 - 1258)': [],
    'Modern Era (1453 - present)': ['Early Modern Period (1453 - 1789)', 'Late Modern Period (1789 - 1945)', 'Contemporary Period (1945 - present)'],
    'Early Modern Period (1453 - 1789)': ['Renaissance (1300 - 1600)', 'Age of Discovery (1400 - 1800)', 'Global Exploration (1500 - 1560)', 'Reformation (1517 - 1648)', 'Scientific Revolution (1543 - 1687)', 'Religious Transformation (1560 - 1648)', 'Enlightenment (1637 - 1800)', 'Age of Absolutism (1648 - 1715)'],
    'Renaissance (1300 - 1600)': [],
    'Age of Discovery (1400 - 1800)': [],
    'Global Exploration (1500 - 1560)': [],
    'Reformation (1517 - 1648)': [],
    'Scientific Revolution (1543 - 1687)': [],
    'Religious Transformation (1560 - 1648)': [],
    'Enlightenment (1637 - 1800)': [],
    'Age of Absolutism (1648 - 1715)': [],
    'Late Modern Period (1789 - 1945)': ['Industrial Revolution (1760 - 1840)', 'Age of Revolutions (1774 - 1849)', 'Imperialism (1800 - 1945)', 'Italy (1800 - 1945)', 'Middle East Conflict (1882 - 1945)', 'World Wars Era (1914 - 1945)'],
    'Industrial Revolution (1760 - 1840)': ['Industrial Age (1760 - 1800)'],
    'Industrial Age (1760 - 1800)': [],
    'Age of Revolutions (1774 - 1849)': [],
    'Imperialism (1800 - 1945)': [],
    'Italy (1800 - 1945)': ['Mussolini\'s Campaign Against the Mafia (1925 - 1929)'],
    'Mussolini\'s Campaign Against the Mafia (1925 - 1929)': [],
    'Middle East Conflict (1882 - 1945)': ['Aliyahs (1882 - 1948)', 'Balfour Declaration (1917)', 'End of Ottoman Palestine (1918)', 'British Military Administration (1918 - 1920)', 'League of Nations Mandate (1920)', 'Haganah (1920)', 'British Mandate for Palestine (1923 - 1948)', 'Western Wall Uprising (1929)', 'Arab Revolt (1936 - 1939)', 'Peel Commission (1937)', 'British White Paper (1939)', 'Jewish Insurgency in Mandatory Palestine (1944 - 1948)'],
    'Aliyahs (1882 - 1948)': ['First Aliyah (1882 - 1903)', 'Second Aliyah (1904 - 1914)', 'Third Aliyah (1919 - 1923)', 'Fourth Aliyah (1924 - 1928)', 'Fifth Aliyah (1929 - 1939)', 'Aliyah Bet (1934 - 1948)'],
    'First Aliyah (1882 - 1903)': [],
    'Second Aliyah (1904 - 1914)': [],
    'Third Aliyah (1919 - 1923)': [],
    'Fourth Aliyah (1924 - 1928)': [],
    'Fifth Aliyah (1929 - 1939)': [],
    'Aliyah Bet (1934 - 1948)': [],
    'Balfour Declaration (1917)': [],
    'End of Ottoman Palestine (1918)': [],
    'British Military Administration (1918 - 1920)': [],
    'League of Nations Mandate (1920)': [],
    'Haganah (1920)': [],
    'British Mandate for Palestine (1923 - 1948)': [],
    'Western Wall Uprising (1929)': [],
    'Arab Revolt (1936 - 1939)': [],
    'Peel Commission (1937)': [],
    'British White Paper (1939)': [],
    'Jewish Insurgency in Mandatory Palestine (1944 - 1948)': ['Lehi (1940 - 1948)'],
    'Lehi (1940 - 1948)': ['Assassination of Lord Moyne (1944)'],
    'Assassination of Lord Moyne (1944)': [],
    'World Wars Era (1914 - 1945)': ['World War I (1914 - 1918)', 'Interwar Period (1918 - 1939)', 'World War II (1939 - 1945)'],
    'World War I (1914 - 1918)': ['Western Front (1914 - 1918)', 'Eastern Front (1914 - 1917)', 'Italian Front (1915 - 1918)', 'Balkan Front (1914 - 1918)', 'Middle Eastern Front (1914 - 1918)', 'African Campaigns (1914 - 1918)', 'Caucasus Campaign (1914 - 1918)', 'Gallipoli Campaign (1915 - 1916)', 'Naval War (1914 - 1918)', 'America in World War I (1917 - 1918)'],
    'Western Front (1914 - 1918)': [],
    'Eastern Front (1914 - 1917)': [],
    'Italian Front (1915 - 1918)': [],
    'Balkan Front (1914 - 1918)': [],
    'Middle Eastern Front (1914 - 1918)': [],
    'African Campaigns (1914 - 1918)': [],
    'Caucasus Campaign (1914 - 1918)': [],
    'Gallipoli Campaign (1915 - 1916)': [],
    'Naval War (1914 - 1918)': [],
    'America in World War I (1917 - 1918)': [],
    'Interwar Period (1918 - 1939)': ['Germany in the Interwar Period (1919 - 1939)'],
    'Germany in the Interwar Period (1919 - 1939)': ['Munich Agreement (1938)'],
    'Munich Agreement (1938)': [],
    'World War II (1939 - 1945)': ['America in World War II (1941 - 1945)', 'European Theater (1939 - 1945)', 'Atlantic Theater (1939 - 1945)', 'MENA Campaign (1940 - 1943)', 'Pacific Theater (1941 - 1945)', 'China-Burma-India Theater (1937 - 1945)', 'End of World War II (1945)'],
    'America in World War II (1941 - 1945)': ['Operation Underworld (1942 - 1945)', 'OSS (1942 - 1945)', 'SS Normandie (1942)', 'Manhattan Project (1942 - 1945)'],
    'Operation Underworld (1942 - 1945)': [],
    'OSS (1942 - 1945)': [],
    'SS Normandie (1942)': [],
    'Manhattan Project (1942 - 1945)': [],
    'European Theater (1939 - 1945)': ['Western Front (1939 - 1945)', 'Eastern Front (1941 - 1945)', 'Italian Campaign (1943 - 1945)', 'Balkan Campaign (1940 - 1945)'],
    'Western Front (1939 - 1945)': [],
    'Eastern Front (1941 - 1945)': [],
    'Italian Campaign (1943 - 1945)': [],
    'Balkan Campaign (1940 - 1945)': [],
    'Atlantic Theater (1939 - 1945)': [],
    'MENA Campaign (1940 - 1943)': [],
    'Pacific Theater (1941 - 1945)': ['Attack on Pearl Harbor (1941)', 'Battle of Midway (1942)', 'Atomic Bombings of Hiroshima and Nagasaki (1945)'],
    'Attack on Pearl Harbor (1941)': [],
    'Battle of Midway (1942)': [],
    'Atomic Bombings of Hiroshima and Nagasaki (1945)': [],
    'China-Burma-India Theater (1937 - 1945)': [],
    'End of World War II (1945)': ['German Surrender (1945)', 'Japanese Surrender (1945)'],
    'German Surrender (1945)': [],
    'Japanese Surrender (1945)': [],
    'Contemporary Period (1945 - present)': ['Post-World War II Era (1945 - 1947)', 'Industrial Age (1945 - 1980)', 'Cold War Era (1947 - 1991)', 'Algerian War of Independence (1954 - 1962)', 'Bangladesh Liberation War (1971)', 'Falklands War (1982)', 'Middle East Conflict (1945 - present)', 'Post-Cold War Era (1991 - 2001)', 'Late 1990s Global Financial Crises (1994 - 2002)', 'Jeffrey Epstein Scandal (2005 - present)', 'Global Financial Crisis (2008 - 2009)', 'Russo-Ukrainian War (2014 - present)', 'European Migrant Crisis (2015)', 'MeToo Movement (2017 - 2018)', 'COVID-19 Pandemic (2019 - 2023)', 'United Kingdom (1945 - present)', 'India (1945 - present)', 'America (1945 - present)', 'Rwanda (1962 - present)'],
    // Post-WWII
    'Post-World War II Era (1945 - 1947)': ['Iron Curtain Speech (1946)', 'Indian and Pakistani Independence (1947)'],
    'Iron Curtain Speech (1946)': [],
    'Indian and Pakistani Independence (1947)': [],
    'Industrial Age (1945 - 1980)': [],
    // Cold War Era
    'Cold War Era (1947 - 1991)': ['USSR during the Cold War (1947 - 1991)', 'America during the Cold War Era (1947 - 1991)', 'Israel during the Cold War Era (1948 - 1991)', 'Arms Race (1947 - 1991)', 'China during the Cold War Era (1947 - 1991)', 'NATO (1949)', 'Two Germanys (1949 - 1990)', 'Korean War (1950 - 1953)', 'Warsaw Pact (1955)', 'Space Race (1957 - 1975)', 'Vietnam War (1955 - 1975)', 'Cuban Revolution (1959)', 'Bay of Pigs Invasion (1961)', 'Operation Mongoose (1961 - 1962)', 'Cuban Missile Crisis (1962)', 'Nuclear Non-Proliferation Treaty (1968)', 'Church Committee (1975 - 1976)', 'INF Treaty (1987)'],
    'USSR during the Cold War (1947 - 1991)': ['Joe-1 Atomic Bomb Test (1949)', 'Death of Joseph Stalin (1953)', "Khrushchev's Secret Speech (1956)", 'Mikhail Gorbachev Becomes General Secretary (1985)', 'Chernobyl Nuclear Disaster (1986)', 'Dissolution of the USSR (1991)'],
    'Joe-1 Atomic Bomb Test (1949)': [],
    'Death of Joseph Stalin (1953)': [],
    "Khrushchev's Secret Speech (1956)": [],
    'Mikhail Gorbachev Becomes General Secretary (1985)': [],
    'Chernobyl Nuclear Disaster (1986)': [],
    'Dissolution of the USSR (1991)': [],
    'America during the Cold War Era (1947 - 1991)': ['National Security Act of 1947', "American Concerns over Israel's Nuclear Program (1960 - 1991)", 'JFK Presidency (1961 - 1963)', 'Operation Northwoods (1962)', 'Assassination of President John F. Kennedy (1963)', 'Church Committee (1975 - 1976)'],
    'National Security Act of 1947': [],
    "American Concerns over Israel's Nuclear Program (1960 - 1991)": ['CIA Dimona Discovery (1960)', 'Kennedy-Ben-Gurion Dimona Negotiations (1961 - 1963)', 'Dimona Reactor Goes Critical (1963)', 'Dimona Inspection (1964)'],
    'CIA Dimona Discovery (1960)': [],
    'Kennedy-Ben-Gurion Dimona Negotiations (1961 - 1963)': [],
    'Dimona Reactor Goes Critical (1963)': [],
    'Dimona Inspection (1964)': [],
    'JFK Presidency (1961 - 1963)': ['Inauguration of JFK (1961)', 'Allen Dulles Replaced by John McCone (1961)'],
    'Inauguration of JFK (1961)': [],
    'Allen Dulles Replaced by John McCone (1961)': [],
    'Operation Northwoods (1962)': [],
    'Assassination of President John F. Kennedy (1963)': ['JFK Motorcade and Shooting (1963)', 'Lee Harvey Oswald (1939 - 1963)', 'Jack Ruby (1911 - 1967)', 'Warren Commission (1963 - 1964)', 'LBJ Becomes President (1963)', 'Alternate Theories'],
    'JFK Motorcade and Shooting (1963)': [],
    'Lee Harvey Oswald (1939 - 1963)': ['Oswald Defects to the Soviet Union (1959)', 'Oswald under Custody (1963)', 'Assassination of Lee Harvey Oswald (1963)'],
    'Oswald Defects to the Soviet Union (1959)': [],
    'Oswald under Custody (1963)': [],
    'Assassination of Lee Harvey Oswald (1963)': [],
    'Jack Ruby (1911 - 1967)': [],
    'Warren Commission (1963 - 1964)': [],
    'LBJ Becomes President (1963)': [],
    'Alternate Theories': ['Mossad Killed Kennedy'],
    'Mossad Killed Kennedy': [],
    'Church Committee (1975 - 1976)': ['CIA Assassination Plots Against Castro', "James Angleton's Testimony"],
    'CIA Assassination Plots Against Castro': [],
    "James Angleton's Testimony": [],
    'Israel during the Cold War Era (1948 - 1991)': ['Dimona Nuclear Reactor (1958 - 1964)'],
    'Dimona Nuclear Reactor (1958 - 1964)': [],
    'Arms Race (1947 - 1991)': [],
    'China during the Cold War Era (1947 - 1991)': ['Great Leap Forward (1958)'],
    'Great Leap Forward (1958)': [],
    'NATO (1949)': [],
    'Two Germanys (1949 - 1990)': ['Construction of the Berlin Wall (1961)', 'Fall of the Berlin Wall (1989)', 'Reunification of Germany (1990)'],
    'Construction of the Berlin Wall (1961)': [],
    'Fall of the Berlin Wall (1989)': [],
    'Reunification of Germany (1990)': [],
    'Korean War (1950 - 1953)': [],
    'Warsaw Pact (1955)': [],
    'Space Race (1957 - 1975)': ['Sputnik 1 (1957)', 'Apollo Program (1961 - 1972)', 'Strategic Defense Initiative (1983)'],
    'Sputnik 1 (1957)': [],
    'Apollo Program (1961 - 1972)': ['Apollo 11 Moon Landing (1969)'],
    'Apollo 11 Moon Landing (1969)': [],
    'Strategic Defense Initiative (1983)': [],
    'Vietnam War (1955 - 1975)': ['Gulf of Tonkin Incident (1964)', 'Gulf of Tonkin Resolution (1964)', 'Escalation of the Vietnam War (1965 - 1966)', 'Tet Offensive (1968)', 'Fall of Saigon (1975)'],
    'Gulf of Tonkin Incident (1964)': [],
    'Gulf of Tonkin Resolution (1964)': [],
    'Escalation of the Vietnam War (1965 - 1966)': [],
    'Tet Offensive (1968)': [],
    'Fall of Saigon (1975)': [],
    'Cuban Revolution (1959)': [],
    'Bay of Pigs Invasion (1961)': [],
    'Operation Mongoose (1961 - 1962)': [],
    'Cuban Missile Crisis (1962)': ['U-2 Spy Plane Discovery (1962)', 'ExComm Deliberations (1962)', 'Naval Quarantine of Cuba (1962)', 'Resolution of the Cuban Missile Crisis (1962)'],
    'U-2 Spy Plane Discovery (1962)': [],
    'ExComm Deliberations (1962)': [],
    'Naval Quarantine of Cuba (1962)': [],
    'Resolution of the Cuban Missile Crisis (1962)': [],
    'Nuclear Non-Proliferation Treaty (1968)': [],
    'INF Treaty (1987)': [],
    // Middle East Conflict (Contemporary)
    'Middle East Conflict (1945 - present)': ['Arab League Creation (1945)', 'Aliyahs (1945 - present)', 'Jewish Insurgency (1945 - 1948)', 'UN Partition Plan for Palestine (1947)', 'Civil War in Mandatory Palestine (1947 - 1948)', '1948 Arab-Israeli War (1948 - 1949)', 'State of Israel (1948 - present)', 'Jordan Annexes the West Bank (1950)', 'Palestinian Fedayeen Attacks (1951 - 1982)', 'First Sudanese Civil War (1955 - 1972)', 'Suez Crisis (1956 - 1957)', 'Palestine Liberation Organization (1964)', 'Six-Day War (1967)', 'Yom Kippur War (1973)', 'Israeli Election of 1977', 'Camp David Accords (1978)', 'First Israeli Invasion of Lebanon (1978)', 'Iranian Revolution (1979)', 'Egypt-Israel Peace Treaty (1979)', 'Soviet-Afghan War (1979 - 1989)', "Iran's Axis of Resistance (1979 - present)", "Saudi Arabia's Sunni Network (1979 - present)", "Pakistan's Deobandi Network (1980 - present)", 'Iran-Iraq War (1980 - 1988)', 'Second Israeli Invasion of Lebanon (1982)', 'Second Sudanese Civil War (1983 - 2005)', 'South Lebanon Conflict (1985 - 2000)', 'Palestinian Intifadas (1987 - 2005)', 'Non-State Extremist Groups (1988 - present)', 'First Gulf War (1990 - 1991)', 'Somali Civil War (1991 - present)', 'Oslo Accords (1993)', 'Israel-Jordan Peace Treaty (1994)', 'Clean Break Report (1996)', "Turkey's Sunni Network (2002 - present)", 'U.S. War on Terror (2001 - 2021)', 'Libya Abandons WMDs (2003)', 'War in Darfur (2003 - 2020)', 'Second Lebanon War (2006)', 'Arab Spring (2010 - 2012)', 'Second Libyan Civil War (2014 - 2020)', 'Yemeni Civil War (2014 - present)', 'JCPOA (2015)', 'JCPOA Withdrawal (2018)', 'Assassination of Qassem Soleimani (2020)', 'Abraham Accords (2020)', 'Third Sudanese Civil War (2023 - present)', 'Gaza War (2023 - present)'],
    'Arab League Creation (1945)': [],
    'Aliyahs (1945 - present)': ['Aliyah Bet (1945 - 1947)', 'Post-Independence Mass Aliyah (1948 - 1951)', 'Law of Return (1950)', 'Aliyah from Arab and Muslim Countries (1948 - 1970)', 'Aliyah from the Soviet Union and Eastern Bloc (1970 - 1991)'],
    'Aliyah Bet (1945 - 1947)': [],
    'Post-Independence Mass Aliyah (1948 - 1951)': [],
    'Law of Return (1950)': [],
    'Aliyah from Arab and Muslim Countries (1948 - 1970)': [],
    'Aliyah from the Soviet Union and Eastern Bloc (1970 - 1991)': [],
    'Jewish Insurgency (1945 - 1948)': ['Haganah (1945 - 1948)', 'Irgun (1945 - 1948)', 'Lehi (1945 - 1948)'],
    'Haganah (1945 - 1948)': ['Weapons Procurement / Rekhesh (1945 - 1948)'],
    'Weapons Procurement / Rekhesh (1945 - 1948)': [],
    'Irgun (1945 - 1948)': ['King David Hotel Bombing (1946)'],
    'King David Hotel Bombing (1946)': [],
    'Lehi (1945 - 1948)': [],
    'UN Partition Plan for Palestine (1947)': [],
    'Civil War in Mandatory Palestine (1947 - 1948)': ['Deir Yassin Massacre (1948)', 'Haganah Captures (1948)'],
    'Deir Yassin Massacre (1948)': [],
    'Haganah Captures (1948)': [],
    '1948 Arab-Israeli War (1948 - 1949)': ['Declaration of Israeli Independence (1948)', 'Arab Coalition Invasion (1948)', 'Nakba (1948)', 'Israeli Military Operations (1948)', 'Armistice Agreements (1949)'],
    'Declaration of Israeli Independence (1948)': [],
    'Arab Coalition Invasion (1948)': [],
    'Nakba (1948)': [],
    'Israeli Military Operations (1948)': ['Operation Dani (1948)', 'Operation Yoav (1948)', 'Operation Hiram (1948)', 'Operation Horev (1948 - 1949)'],
    'Operation Dani (1948)': [],
    'Operation Yoav (1948)': [],
    'Operation Hiram (1948)': [],
    'Operation Horev (1948 - 1949)': [],
    'Armistice Agreements (1949)': [],
    'State of Israel (1948 - present)': ['Lavon Affair (1954)', 'Oded Yinon Plan (1982)', 'Patriot Missile Defense System (1984)', 'Arrow 2 Missile Defense System (2000)', 'Iron Dome (2011)', 'Arrow 3 Missile Defense System (2017)', "David's Sling (2017)"],
    'Lavon Affair (1954)': [],
    'Oded Yinon Plan (1982)': [],
    'Patriot Missile Defense System (1984)': [],
    'Arrow 2 Missile Defense System (2000)': [],
    'Iron Dome (2011)': [],
    'Arrow 3 Missile Defense System (2017)': [],
    "David's Sling (2017)": [],
    'Jordan Annexes the West Bank (1950)': [],
    'Palestinian Fedayeen Attacks (1951 - 1982)': ["Egypt's Support for Fedayeen (1954 - 1956)"],
    "Egypt's Support for Fedayeen (1954 - 1956)": [],
    'First Sudanese Civil War (1955 - 1972)': [],
    'Suez Crisis (1956 - 1957)': ['Nationalization of the Suez Canal (1956)', 'Protocol of Sèvres (1956)', 'Suez Military Operations (1956)', 'International Pressure and Withdrawal (1956 - 1957)'],
    'Nationalization of the Suez Canal (1956)': [],
    'Protocol of Sèvres (1956)': [],
    'Suez Military Operations (1956)': [],
    'International Pressure and Withdrawal (1956 - 1957)': [],
    'Palestine Liberation Organization (1964)': [],
    'Six-Day War (1967)': ['USS Liberty Incident (1967)'],
    'USS Liberty Incident (1967)': [],
    'Yom Kippur War (1973)': ['Operation Nickel Grass (1973)'],
    'Operation Nickel Grass (1973)': [],
    'Israeli Election of 1977': [],
    'Camp David Accords (1978)': [],
    'First Israeli Invasion of Lebanon (1978)': [],
    'Iranian Revolution (1979)': [],
    'Egypt-Israel Peace Treaty (1979)': [],
    'Soviet-Afghan War (1979 - 1989)': ['Soviet Invasion of Afghanistan (1979 - 1980)', 'Soviet Withdrawal from Afghanistan (1988 - 1989)'],
    'Soviet Invasion of Afghanistan (1979 - 1980)': [],
    'Soviet Withdrawal from Afghanistan (1988 - 1989)': [],
    "Iran's Axis of Resistance (1979 - present)": ['IRGC (1979)', 'Syrian Alliance (1979)', 'Hezbollah (1982)', 'Palestinian Islamic Jihad (1987)', 'Hamas (1990)', 'Houthi Movement (1992)', 'Iraqi Shia Militias (2003)', 'Bahraini Proxy (1981)'],
    'IRGC (1979)': ['Quds Force (1988)'],
    'Quds Force (1988)': [],
    'Syrian Alliance (1979)': [],
    'Hezbollah (1982)': [],
    'Palestinian Islamic Jihad (1987)': [],
    'Hamas (1990)': [],
    'Houthi Movement (1992)': [],
    'Iraqi Shia Militias (2003)': ['Badr Organization (1982)', 'Asaib Ahl al-Haq (2006)', 'Kataib Hezbollah (2007)', 'Popular Mobilization Forces (2014)'],
    'Badr Organization (1982)': [],
    'Asaib Ahl al-Haq (2006)': [],
    'Kataib Hezbollah (2007)': [],
    'Popular Mobilization Forces (2014)': [],
    'Bahraini Proxy (1981)': [],
    "Saudi Arabia's Sunni Network (1979 - present)": ['Gulf Cooperation Council (1981)'],
    'Gulf Cooperation Council (1981)': [],
    "Pakistan's Deobandi Network (1980 - present)": ['Taliban (1994)'],
    'Taliban (1994)': [],
    'Iran-Iraq War (1980 - 1988)': ['Operation Opera (1981)'],
    'Operation Opera (1981)': [],
    'Second Israeli Invasion of Lebanon (1982)': [],
    'Second Sudanese Civil War (1983 - 2005)': [],
    'South Lebanon Conflict (1985 - 2000)': [],
    'Palestinian Intifadas (1987 - 2005)': ['First Intifada (1987 - 1993)', 'Second Intifada (2000 - 2005)'],
    'First Intifada (1987 - 1993)': [],
    'Second Intifada (2000 - 2005)': [],
    'Non-State Extremist Groups (1988 - present)': ['Al-Qaeda (1988 - present)', 'ISIS (2004 - present)', 'Hayat Tahrir al-Sham (2017 - present)'],
    'Al-Qaeda (1988 - present)': [],
    'ISIS (2004 - present)': [],
    'Hayat Tahrir al-Sham (2017 - present)': [],
    'First Gulf War (1990 - 1991)': ['Iraq Invades Kuwait (1990)', 'Operation Desert Storm (1991)'],
    'Iraq Invades Kuwait (1990)': [],
    'Operation Desert Storm (1991)': [],
    'Somali Civil War (1991 - present)': [],
    'Oslo Accords (1993)': [],
    'Israel-Jordan Peace Treaty (1994)': [],
    'Clean Break Report (1996)': [],
    "Turkey's Sunni Network (2002 - present)": [],
    'U.S. War on Terror (2001 - 2021)': ['9/11 Attacks (2001)', 'War in Afghanistan (2001 - 2021)', 'Iraq War (2003 - 2011)'],
    '9/11 Attacks (2001)': [],
    'War in Afghanistan (2001 - 2021)': ['U.S. Withdrawal from Afghanistan (2021)'],
    'U.S. Withdrawal from Afghanistan (2021)': [],
    'Iraq War (2003 - 2011)': ['U.S. Invasion of Iraq (2003)', 'Execution of Saddam Hussein (2006)', 'Iraqi Insurgency (2006 - present)', 'U.S. Withdrawal from Iraq (2011)'],
    'U.S. Invasion of Iraq (2003)': [],
    'Execution of Saddam Hussein (2006)': [],
    'Iraqi Insurgency (2006 - present)': [],
    'U.S. Withdrawal from Iraq (2011)': [],
    'Libya Abandons WMDs (2003)': [],
    'War in Darfur (2003 - 2020)': [],
    'Second Lebanon War (2006)': [],
    'Arab Spring (2010 - 2012)': ['Tunisian Revolution (2010 - 2011)', 'First Libyan Civil War (2011)', 'Syrian Civil War (2011 - present)'],
    'Tunisian Revolution (2010 - 2011)': [],
    'First Libyan Civil War (2011)': [],
    'Syrian Civil War (2011 - present)': ['Fall of Assad (2024)'],
    'Fall of Assad (2024)': [],
    'Second Libyan Civil War (2014 - 2020)': [],
    'Yemeni Civil War (2014 - present)': [],
    'JCPOA (2015)': [],
    'JCPOA Withdrawal (2018)': [],
    'Assassination of Qassem Soleimani (2020)': [],
    'Abraham Accords (2020)': [],
    'Third Sudanese Civil War (2023 - present)': [],
    'Gaza War (2023 - present)': ['Hamas Attack on Israel (2023)', 'Israel-Hezbollah Conflict (2023 - present)', 'Israel-Houthi Conflict (2023 - present)', 'Iran-Israel Escalation (2024)', 'Operation Rising Lion (2025)'],
    'Hamas Attack on Israel (2023)': ['Israeli Ground Invasion of Gaza (2023)', 'Gaza Buffer Zone (2023 - present)', 'Rafah Siege (2024)', 'Haniyeh Assassination (2024)'],
    'Israeli Ground Invasion of Gaza (2023)': [],
    'Gaza Buffer Zone (2023 - present)': [],
    'Rafah Siege (2024)': [],
    'Haniyeh Assassination (2024)': [],
    'Israel-Hezbollah Conflict (2023 - present)': ['Pager and Walkie-Talkie Attacks (2024)', 'Assassination of Hassan Nasrallah (2024)', 'Israeli Invasion of Southern Lebanon (2024)'],
    'Pager and Walkie-Talkie Attacks (2024)': [],
    'Assassination of Hassan Nasrallah (2024)': [],
    'Israeli Invasion of Southern Lebanon (2024)': [],
    'Israel-Houthi Conflict (2023 - present)': ['Houthi Red Sea Attacks (2023)', 'Operation Poseidon Archer (2024)', 'Operation Rough Rider (2025)'],
    'Houthi Red Sea Attacks (2023)': [],
    'Operation Poseidon Archer (2024)': [],
    'Operation Rough Rider (2025)': [],
    'Iran-Israel Escalation (2024)': ['Operation True Promise (2024)', 'Operation True Promise II (2024)', 'Operation Days of Repentance (2024)', 'THAAD Deployment to Israel (2024)'],
    'Operation True Promise (2024)': [],
    'Operation True Promise II (2024)': [],
    'Operation Days of Repentance (2024)': [],
    'THAAD Deployment to Israel (2024)': [],
    'Operation Rising Lion (2025)': [],
    // America (contemporary)
    'America (1945 - present)': ["Israeli Influence over America (1945 - present)", 'Brown v. Board of Education (1954)', '1960 Presidential Election', 'Civil Rights Act of 1964', 'Kent State Shootings (1970)', 'Watergate (1972 - 1974)', 'Roe v. Wade (1973)', 'U.S. Bicentennial (1976)', 'Star Wars: A New Hope (1977)', 'AIDS Epidemic (1981 - present)', '1996 Presidential Election', '2000 Presidential Election', 'Hurricane Katrina (2005)', '2008 Presidential Election', '2016 Presidential Election', '2017 JFK File Declassification', 'First Impeachment of Donald Trump (2019 - 2020)', '2020 Presidential Election', 'Attack on the U.S. Capitol (2021)', 'Second Impeachment of Donald Trump (2021)', 'Buffalo Mass Shooting (2022)', 'Trump Indictments (2023)', '2024 Presidential Election', '2025 JFK File Declassification'],
    "Israeli Influence over America (1945 - present)": ["Trump's Second Term Pro-Israel Policies", 'Federal Crackdown on Campus Antisemitism (2023 - present)', 'AIPAC and Pro-Israel Political Spending'],
    "Trump's Second Term Pro-Israel Policies": [],
    'Federal Crackdown on Campus Antisemitism (2023 - present)': ['Columbia University Federal Pressure (2025)', 'Harvard University Federal Pressure (2025)'],
    'Columbia University Federal Pressure (2025)': [],
    'Harvard University Federal Pressure (2025)': [],
    'AIPAC and Pro-Israel Political Spending': [],
    'Brown v. Board of Education (1954)': [],
    '1960 Presidential Election': [],
    'Civil Rights Act of 1964': [],
    'Kent State Shootings (1970)': [],
    'Watergate (1972 - 1974)': ['Watergate Break-In (1972)', 'Nixon Resignation (1974)'],
    'Watergate Break-In (1972)': [],
    'Nixon Resignation (1974)': [],
    'Roe v. Wade (1973)': [],
    'U.S. Bicentennial (1976)': [],
    'Star Wars: A New Hope (1977)': [],
    'AIDS Epidemic (1981 - present)': [],
    '1996 Presidential Election': [],
    '2000 Presidential Election': [],
    'Hurricane Katrina (2005)': [],
    '2008 Presidential Election': [],
    '2016 Presidential Election': [],
    '2017 JFK File Declassification': [],
    'First Impeachment of Donald Trump (2019 - 2020)': [],
    '2020 Presidential Election': [],
    'Attack on the U.S. Capitol (2021)': [],
    'Second Impeachment of Donald Trump (2021)': [],
    'Buffalo Mass Shooting (2022)': [],
    'Trump Indictments (2023)': [],
    '2024 Presidential Election': ['Assassination Attempt on Donald Trump (2024)', 'Biden Withdrawal from Race (2024)', 'Trump Defeats Kamala Harris (2024)', 'Institutional Shift Toward Trump (2024)'],
    'Assassination Attempt on Donald Trump (2024)': [],
    'Biden Withdrawal from Race (2024)': [],
    'Trump Defeats Kamala Harris (2024)': [],
    'Institutional Shift Toward Trump (2024)': [],
    '2025 JFK File Declassification': [],
    // Other contemporary nodes
    'United Kingdom (1945 - present)': ['Queen Elizabeth II Ascends (1952)'],
    'Queen Elizabeth II Ascends (1952)': [],
    'India (1945 - present)': ['Bhopal Gas Tragedy (1984)'],
    'Bhopal Gas Tragedy (1984)': [],
    'Rwanda (1962 - present)': ['Rwandan Genocide (1994)'],
    'Rwandan Genocide (1994)': [],
    'Algerian War of Independence (1954 - 1962)': [],
    'Bangladesh Liberation War (1971)': [],
    'Falklands War (1982)': [],
    'Post-Cold War Era (1991 - 2001)': ['Yugoslav Wars (1991 - 2001)'],
    'Yugoslav Wars (1991 - 2001)': ['Croatian War of Independence (1991 - 1995)', 'Bosnian War (1992 - 1995)', 'Kosovo War (1998 - 1999)', 'Macedonian Conflict (2001)'],
    'Croatian War of Independence (1991 - 1995)': [],
    'Bosnian War (1992 - 1995)': [],
    'Kosovo War (1998 - 1999)': ['NATO Bombing of Yugoslavia (1999)'],
    'NATO Bombing of Yugoslavia (1999)': [],
    'Macedonian Conflict (2001)': [],
    'Late 1990s Global Financial Crises (1994 - 2002)': ['Mexican Peso Crisis (1994 - 1995)', 'Asian Financial Crisis (1997 - 1998)', 'Russian Financial Crisis (1998)', 'Argentine Economic Crisis (1999 - 2002)'],
    'Mexican Peso Crisis (1994 - 1995)': [],
    'Asian Financial Crisis (1997 - 1998)': [],
    'Russian Financial Crisis (1998)': [],
    'Argentine Economic Crisis (1999 - 2002)': [],
    'Jeffrey Epstein Scandal (2005 - present)': ['Death of Jeffrey Epstein (2019)'],
    'Death of Jeffrey Epstein (2019)': [],
    'Global Financial Crisis (2008 - 2009)': ['U.S. Subprime Mortgage Collapse (2007)', 'Lehman Brothers Bankruptcy (2008)'],
    'U.S. Subprime Mortgage Collapse (2007)': [],
    'Lehman Brothers Bankruptcy (2008)': [],
    'Russo-Ukrainian War (2014 - present)': ['Russian Annexation of Crimea (2014)', 'War in Donbas (2014 - 2022)', 'Russian Invasion of Ukraine (2022 - present)'],
    'Russian Annexation of Crimea (2014)': [],
    'War in Donbas (2014 - 2022)': [],
    'Russian Invasion of Ukraine (2022 - present)': [],
    'European Migrant Crisis (2015)': [],
    'MeToo Movement (2017 - 2018)': [],
    'COVID-19 Pandemic (2019 - 2023)': [],
    
    // Religious Studies
    'Religious Studies': ['Western Religions', 'Eastern Religions', 'Biblical Studies', 'Comparative Religion', 'Religious Philosophy', 'Mythology'],
    'Western Religions': ['Christianity', 'Judaism', 'Islam'],
    'Christianity': ['Catholicism', 'Protestantism', 'Orthodox Christianity', 'Christian Theology', 'Christian History'],
    'Catholicism': [],
    'Protestantism': [],
    'Orthodox Christianity': [],
    'Christian Theology': [],
    'Christian History': [],
    'Judaism': ['Jewish Law', 'Jewish Philosophy', 'Jewish History', 'Kabbalah'],
    'Jewish Law': [],
    'Jewish Philosophy': [],
    'Jewish History': [],
    'Kabbalah': [],
    'Islam': ['Islamic Law', 'Islamic Theology', 'Islamic Philosophy', 'Islamic History', 'Qur\'anic Studies'],
    'Islamic Law': [],
    'Islamic Theology': [],
    'Islamic Philosophy': [],
    'Islamic History': [],
    'Qur\'anic Studies': [],
    'Eastern Religions': ['Dharmic/Indic Religions', 'East Asian Religions'],

    'Dharmic/Indic Religions': ['Buddhism', 'Hinduism', 'Sikhism', 'Jainism'],
    'Buddhism': ['Theravada', 'Mahayana', 'Vajrayana', 'Buddhist Philosophy', 'Buddhist History'],
    'Theravada': [],
    'Mahayana': ['Zen Buddhism'],
    'Zen Buddhism': [],
    'Vajrayana': [],
    'Buddhist Philosophy': [],
    'Buddhist History': [],
    'Hinduism': ['Vedanta', 'Yoga', 'Hindu Philosophy', 'Hindu History'],
    'Vedanta': [],
    'Yoga': [],
    'Hindu Mythology': [],
    'Hindu Philosophy': [],
    'Hindu History': [],
    'Sikhism': [],
    'Jainism': [],

    'East Asian Religions': ['Taoism', 'Shinto', 'Vietnamese Folk Religion'],
    'Taoism': [],
    'Shinto': [],
    'Vietnamese Folk Religion': [],
    'Biblical Studies': ['Old Testament/Hebrew Bible (Tanakh)', 'New Testament', 'Biblical Theology', 'Biblical Archaeology', 'Biblical Languages'],
    'Old Testament/Hebrew Bible (Tanakh)': ['The Pentateuch (The Law/Torah)', 'Historical Books', 'Poetic/Wisdom Books', 'Prophetic Books'],

    // The Pentateuch
    'The Pentateuch (The Law/Torah)': ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],

    // Genesis
    'Genesis': ['1–2:3 (The Seven Days of Creation)', '2:4–3 (The Garden of Eden and the Fall)', '4 (Cain and Abel)', '5 (The Generations of Adam)', '6–9 (The Great Flood and Noahic Covenant)', '10–11:9 (The Table of Nations and Tower of Babel)', '11:10–25:11 (The Abrahamic Cycle)', '25:12–18 (The Descendants of Ishmael)', '25:19–36 (The Jacob Narrative)', '37–50 (The Story of Joseph)'],
    '1–2:3 (The Seven Days of Creation)': ['1:1–2 (The Initial State)', '1:3–5 (Day One: Light)', '1:6–8 (Day Two: The Expanse)', '1:9–13 (Day Three: Land and Vegetation)', '1:14–19 (Day Four: Luminaries)', '1:20–23 (Day Five: Sea and Sky Life)', '1:24–31 (Day Six: Land Animals and Humanity)', '2:1–3 (Day Seven: The Divine Rest)'],
    '1:1–2 (The Initial State)': ['Gen 1:1', 'Gen 1:2'],
    'Gen 1:1': [],
    'Gen 1:2': [],
    '1:3–5 (Day One: Light)': ['Gen 1:3', 'Gen 1:4', 'Gen 1:5'],
    'Gen 1:3': [],
    'Gen 1:4': [],
    'Gen 1:5': [],
    '1:6–8 (Day Two: The Expanse)': ['Gen 1:6', 'Gen 1:7', 'Gen 1:8'],
    'Gen 1:6': [],
    'Gen 1:7': [],
    'Gen 1:8': [],
    '1:9–13 (Day Three: Land and Vegetation)': ['Gen 1:9', 'Gen 1:10', 'Gen 1:11', 'Gen 1:12', 'Gen 1:13'],
    'Gen 1:9': [],
    'Gen 1:10': [],
    'Gen 1:11': [],
    'Gen 1:12': [],
    'Gen 1:13': [],
    '1:14–19 (Day Four: Luminaries)': [],
    '1:20–23 (Day Five: Sea and Sky Life)': [],
    '1:24–31 (Day Six: Land Animals and Humanity)': ['Gen 1:31'],
    'Gen 1:31': [],
    '2:1–3 (Day Seven: The Divine Rest)': ['Gen 2:1', 'Gen 2:2', 'Gen 2:3'],
    'Gen 2:1': [],
    'Gen 2:2': [],
    'Gen 2:3': [],
    '2:4–3 (The Garden of Eden and the Fall)': ['2:4–17 (The Creation of Man and the Garden)', '2:18–25 (The Creation of Woman)', '3:1–7 (The Temptation and Fall)', '3:8–13 (God Confronts the Couple)', '3:14–19 (The Curses and Consequences)', '3:20–24 (Expulsion from Eden)'],
    '2:4–17 (The Creation of Man and the Garden)': [],
    '2:18–25 (The Creation of Woman)': ['Gen 2:22'],
    'Gen 2:22': [],
    '3:1–7 (The Temptation and Fall)': [],
    '3:8–13 (God Confronts the Couple)': [],
    '3:14–19 (The Curses and Consequences)': ['Gen 3:16'],
    'Gen 3:16': [],
    '3:20–24 (Expulsion from Eden)': [],
    '4 (Cain and Abel)': ['Gen 4:16'],
    'Gen 4:16': [],
    '5 (The Generations of Adam)': [],
    '6–9 (The Great Flood and Noahic Covenant)': [],
    '10–11:9 (The Table of Nations and Tower of Babel)': [],
    '11:10–25:11 (The Abrahamic Cycle)': ['11:10–26 (The Lineage of Shem to Terah)', '12:1–9 (The Call of Abram)', '12:10–20 (Abram and Sarai in Egypt)', '13 (The Separation of Abram and Lot)', '14 (The Rescue of Lot and Melchizedek)', '15 (The Covenant of the Pieces)', '16 (The Birth of Ishmael)', '17 (The Covenant of Circumcision)', '18:1–19:38 (The Visitors and the Fate of Sodom)', '20 (Abraham and Abimelech)', '21 (The Birth of Isaac and the Expulsion of Hagar)', '22 (The Binding of Isaac)', '23 (The Death and Burial of Sarah)', '24 (A Wife for Isaac)', '25:1–11 (The Death of Abraham)'],
    '11:10–26 (The Lineage of Shem to Terah)': [],
    '12:1–9 (The Call of Abram)': [],
    '12:10–20 (Abram and Sarai in Egypt)': [],
    '13 (The Separation of Abram and Lot)': [],
    '14 (The Rescue of Lot and Melchizedek)': [],
    '15 (The Covenant of the Pieces)': ['Gen 15:6'],
    'Gen 15:6': [],
    '16 (The Birth of Ishmael)': [],
    '17 (The Covenant of Circumcision)': [],
    '18:1–19:38 (The Visitors and the Fate of Sodom)': [],
    '20 (Abraham and Abimelech)': [],
    '21 (The Birth of Isaac and the Expulsion of Hagar)': [],
    '22 (The Binding of Isaac)': [],
    '23 (The Death and Burial of Sarah)': [],
    '24 (A Wife for Isaac)': [],
    '25:1–11 (The Death of Abraham)': [],
    '25:12–18 (The Descendants of Ishmael)': [],
    '25:19–36 (The Jacob Narrative)': [],
    '37–50 (The Story of Joseph)': ['37 (Joseph and His Brothers)', '38 (Judah and Tamar)', '39–40 (Joseph in Egypt and the Prison Dreams)', '41 (Pharaoh\'s Dreams and Joseph\'s Rise)', '42–45 (The Brothers in Egypt and Joseph\'s Revelation)', '46–47 (Jacob\'s Migration and Settlement in Goshen)', '48–49 (Jacob\'s Blessings and Death)', '50 (The Burial of Jacob and Joseph\'s Final Days)'],
    '37 (Joseph and His Brothers)': [],
    '38 (Judah and Tamar)': [],
    '39–40 (Joseph in Egypt and the Prison Dreams)': [],
    '41 (Pharaoh\'s Dreams and Joseph\'s Rise)': ['41:1–8 (Pharaoh\'s Troubling Dreams)', '41:9–36 (Joseph\'s Interpretation and Counsel)', '41:37–45 (The Promotion of Joseph)', '41:46–57 (The Seven Years of Plenty and Famine)'],
    '41:1–8 (Pharaoh\'s Troubling Dreams)': [],
    '41:9–36 (Joseph\'s Interpretation and Counsel)': [],
    '41:37–45 (The Promotion of Joseph)': [],
    '41:46–57 (The Seven Years of Plenty and Famine)': [],
    '42–45 (The Brothers in Egypt and Joseph\'s Revelation)': [],
    '46–47 (Jacob\'s Migration and Settlement in Goshen)': [],
    '48–49 (Jacob\'s Blessings and Death)': [],
    '50 (The Burial of Jacob and Joseph\'s Final Days)': [],

    // Exodus
    'Exodus': ['1 (The Oppression of Israel)', '2:1–10 (The Birth and Rescue of Moses)', '2:11–25 (Moses Flees to Midian)', '3–4:17 (The Burning Bush and Call of Moses)', '4:18–7:7 (Moses Returns to Egypt)', '7 (The Ten Plagues of Egypt)', '12–13:16 (The Passover and Exodus)', '13:17–15:21 (Crossing the Red Sea)', '15:22–18 (The Wilderness Trek to Sinai)', '19–24 (The Covenant and Ten Commandments at Sinai)', '25–31 (Instructions for the Tabernacle)', '32–34 (The Golden Calf and Covenant Renewal)', '35–40 (The Construction and Dedication of the Tabernacle)'],
    '1 (The Oppression of Israel)': [],
    '2:1–10 (The Birth and Rescue of Moses)': [],
    '2:11–25 (Moses Flees to Midian)': [],
    '3–4:17 (The Burning Bush and Call of Moses)': [],
    '4:18–7:7 (Moses Returns to Egypt)': [],
    '7 (The Ten Plagues of Egypt)': ['7:1–13 (Aaron\'s Staff Becomes a Snake)', '7:14–25 (The First Plague: Nile to Blood)', '7:25–8:15 (The Second Plague: Frogs)', '8:16–19 (The Third Plague: Gnats)', '8:20–32 (The Fourth Plague: Flies)', '9:1–7 (The Fifth Plague: Livestock Die)', '9:8–12 (The Sixth Plague: Boils)', '9:13–35 (The Seventh Plague: Hail)', '10:1–20 (The Eighth Plague: Locusts)', '10:21–29 (The Ninth Plague: Darkness)', '11 (Announcement of the Tenth Plague)'],
    '7:1–13 (Aaron\'s Staff Becomes a Snake)': [],
    '7:14–25 (The First Plague: Nile to Blood)': [],
    '7:25–8:15 (The Second Plague: Frogs)': [],
    '8:16–19 (The Third Plague: Gnats)': [],
    '8:20–32 (The Fourth Plague: Flies)': ['Exod 8:22', 'Exod 8:23'],
    'Exod 8:22': [],
    'Exod 8:23': [],
    '9:1–7 (The Fifth Plague: Livestock Die)': ['Exod 9:4', 'Exod 9:5', 'Exod 9:6'],
    'Exod 9:4': [],
    'Exod 9:5': [],
    'Exod 9:6': [],
    '9:8–12 (The Sixth Plague: Boils)': [],
    '9:13–35 (The Seventh Plague: Hail)': ['Exod 9:26'],
    'Exod 9:26': [],
    '10:1–20 (The Eighth Plague: Locusts)': [],
    '10:21–29 (The Ninth Plague: Darkness)': [],
    '11 (Announcement of the Tenth Plague)': [],
    '12–13:16 (The Passover and Exodus)': ['12:1–13 (The Passover Lamb)', '12:14–20 (The Festival of Unleavened Bread)', '12:21–28 (Instructions to the Elders)', '12:29–36 (The Tenth Plague and the Exodus)', '12:37–42 (The Journey Begins)', '12:43–51 (Passover Restrictions)', '13:1–16 (Consecration of the Firstborn)'],
    '12:1–13 (The Passover Lamb)': ['Exod 12:13'],
    'Exod 12:13': [],
    '12:14–20 (The Festival of Unleavened Bread)': [],
    '12:21–28 (Instructions to the Elders)': [],
    '12:29–36 (The Tenth Plague and the Exodus)': [],
    '12:37–42 (The Journey Begins)': [],
    '12:43–51 (Passover Restrictions)': [],
    '13:1–16 (Consecration of the Firstborn)': [],
    '13:17–15:21 (Crossing the Red Sea)': [],
    '15:22–18 (The Wilderness Trek to Sinai)': [],
    '19–24 (The Covenant and Ten Commandments at Sinai)': ['19 (Israel at Mount Sinai)', '20:1–17 (The Ten Commandments)', '20:18–26 (The People\'s Response and Altar Laws)', '21–23 (The Book of the Covenant)', '24 (The Covenant Ratified)'],
    '19 (Israel at Mount Sinai)': [],
    '20:1–17 (The Ten Commandments)': ['Exod 20:3', 'Exod 20:4', 'Exod 20:5', 'Exod 20:11'],
    'Exod 20:3': [],
    'Exod 20:4': [],
    'Exod 20:5': [],
    'Exod 20:11': [],
    '20:18–26 (The People\'s Response and Altar Laws)': [],
    '21–23 (The Book of the Covenant)': ['21:1–11 (Laws Concerning Hebrew Servants)', '21:12–36 (Laws on Violence and Animal Liability)', '22:1–15 (Laws Regarding Property and Theft)', '22:16–31 (Social and Religious Statutes)', '23:1–19 (Justice for All and Annual Feasts)', '23:20–33 (Promises and Instructions for the Conquest)'],
    '21:1–11 (Laws Concerning Hebrew Servants)': [],
    '21:12–36 (Laws on Violence and Animal Liability)': ['Exod 21:20', 'Exod 21:21'],
    'Exod 21:20': [],
    'Exod 21:21': [],
    '22:1–15 (Laws Regarding Property and Theft)': [],
    '22:16–31 (Social and Religious Statutes)': ['Exod 22:29'],
    'Exod 22:29': [],
    '23:1–19 (Justice for All and Annual Feasts)': [],
    '23:20–33 (Promises and Instructions for the Conquest)': [],
    '24 (The Covenant Ratified)': [],
    '25–31 (Instructions for the Tabernacle)': ['25:1–9 (Offerings for the Sanctuary)', '25:10–22 (The Ark of the Covenant)', '25:23–30 (The Table for Showbread)', '25:31–40 (The Golden Lampstand)', '26 (The Tabernacle Structure)', '27:1–8 (The Altar of Burnt Offering)', '27:9–19 (The Courtyard)', '27:20–21 (Oil for the Lampstand)', '28 (The Priestly Garments)', '29 (Consecration of the Priests)', '30:1–10 (The Altar of Incense)', '30:11–16 (Atonement Money)', '30:17–21 (The Bronze Basin)', '30:22–38 (The Anointing Oil and Incense)', '31:1–11 (Bezalel and Oholiab)', '31:12–18 (The Sabbath and the Tablets)'],
    '25:1–9 (Offerings for the Sanctuary)': [],
    '25:10–22 (The Ark of the Covenant)': [],
    '25:23–30 (The Table for Showbread)': [],
    '25:31–40 (The Golden Lampstand)': [],
    '26 (The Tabernacle Structure)': ['Exod 26:31'],
    'Exod 26:31': [],
    '27:1–8 (The Altar of Burnt Offering)': [],
    '27:9–19 (The Courtyard)': [],
    '27:20–21 (Oil for the Lampstand)': [],
    '28 (The Priestly Garments)': [],
    '29 (Consecration of the Priests)': [],
    '30:1–10 (The Altar of Incense)': [],
    '30:11–16 (Atonement Money)': [],
    '30:17–21 (The Bronze Basin)': [],
    '30:22–38 (The Anointing Oil and Incense)': [],
    '31:1–11 (Bezalel and Oholiab)': [],
    '31:12–18 (The Sabbath and the Tablets)': [],
    '32–34 (The Golden Calf and Covenant Renewal)': [],
    '35–40 (The Construction and Dedication of the Tabernacle)': ['35:1–3 (Sabbath Regulations)', '35:4–29 (Materials and Willing Hearts)', '35:30–36:7 (The Skill of the Craftsmen)', '36:8–38 (Construction of the Tabernacle)', '37 (Making the Furniture)', '38:1–20 (The Bronze Altar and Courtyard)', '38:21–31 (The Inventory of Materials)', '39:1–31 (The Priestly Garments)', '39:32–43 (Moses Inspects the Work)', '40:1–33 (Setting Up the Tabernacle)', '40:34–38 (The Glory of the Lord)'],
    '35:1–3 (Sabbath Regulations)': [],
    '35:4–29 (Materials and Willing Hearts)': [],
    '35:30–36:7 (The Skill of the Craftsmen)': [],
    '36:8–38 (Construction of the Tabernacle)': [],
    '37 (Making the Furniture)': [],
    '38:1–20 (The Bronze Altar and Courtyard)': [],
    '38:21–31 (The Inventory of Materials)': [],
    '39:1–31 (The Priestly Garments)': ['Exod 39:2'],
    'Exod 39:2': [],
    '39:32–43 (Moses Inspects the Work)': [],
    '40:1–33 (Setting Up the Tabernacle)': [],
    '40:34–38 (The Glory of the Lord)': [],

    // Leviticus
    'Leviticus': ['1–7 (The Laws of Sacrifice)', '8–10 (The Consecration and Sin of the Priesthood)', '11–15 (Laws Regarding Purity and Uncleanness)', '16 (The Day of Atonement)', '17–26 (The Holiness Code)', '27 (Laws Concerning Vows and Tithes)'],
    '1–7 (The Laws of Sacrifice)': [],
    '8–10 (The Consecration and Sin of the Priesthood)': [],
    '11–15 (Laws Regarding Purity and Uncleanness)': [],
    '16 (The Day of Atonement)': [],
    '17–26 (The Holiness Code)': ['17 (The Sanctity of Life and Sacrifice)', '18–20 (Laws of Sexual and Social Purity)', '21–22 (Regulations for Priestly Holiness)', '23–25 (The Sacred Calendar and Land Sabbath)', '26 (Blessings and Curses)'],
    '17 (The Sanctity of Life and Sacrifice)': [],
    '18–20 (Laws of Sexual and Social Purity)': [],
    '21–22 (Regulations for Priestly Holiness)': ['21:1–9 (Regulations for Ordinary Priests)', '21:10–15 (Regulations for the High Priest)', '21:16–24 (Physical Requirements for Priests)', '22:1–16 (Purity and Holy Offerings)', '22:17–33 (Acceptable Sacrifices)'],
    '21:1–9 (Regulations for Ordinary Priests)': ['Lev 21:9'],
    'Lev 21:9': [],
    '21:10–15 (Regulations for the High Priest)': [],
    '21:16–24 (Physical Requirements for Priests)': [],
    '22:1–16 (Purity and Holy Offerings)': [],
    '22:17–33 (Acceptable Sacrifices)': [],
    '23–25 (The Sacred Calendar and Land Sabbath)': ['23:1–3 (The Sabbath)', '23:4–44 (The Annual Festivals)', '24:1–9 (The Lamp and the Bread)', '24:10–23 (The Law of Blasphemy and Retribution)', '25 (The Sabbatical and Jubilee Years)'],
    '23:1–3 (The Sabbath)': [],
    '23:4–44 (The Annual Festivals)': [],
    '24:1–9 (The Lamp and the Bread)': [],
    '24:10–23 (The Law of Blasphemy and Retribution)': ['Lev 24:16'],
    'Lev 24:16': [],
    '25 (The Sabbatical and Jubilee Years)': ['25:1–7 (The Sabbatical Year)', '25:8–17 (The Year of Jubilee)', '25:18–34 (The Redemption of Property)', '25:35–55 (The Redemption of the Poor and Enslaved)'],
    '25:1–7 (The Sabbatical Year)': [],
    '25:8–17 (The Year of Jubilee)': [],
    '25:18–34 (The Redemption of Property)': [],
    '25:35–55 (The Redemption of the Poor and Enslaved)': ['Lev 25:44', 'Lev 25:45', 'Lev 25:46'],
    'Lev 25:44': [],
    'Lev 25:45': [],
    'Lev 25:46': [],
    '26 (Blessings and Curses)': ['Lev 26:13', 'Lev 26:21', 'Lev 26:22'],
    'Lev 26:13': [],
    'Lev 26:21': [],
    'Lev 26:22': [],
    '27 (Laws Concerning Vows and Tithes)': [],

    // Numbers
    'Numbers': ['1–4 (The Census and Organization of the Camp)', '5–10:10 (Purification and Preparation for the Journey)', '10:11–14 (Departure from Sinai and the Rebellion at Kadesh)', '15–19 (Laws and Rebellions in the Wilderness)', '20–25 (The Journey from Kadesh to Moab)', '26–30 (The Second Census and New Regulations)', '31–36 (Preparation to Enter the Promised Land)'],
    '1–4 (The Census and Organization of the Camp)': [],
    '5–10:10 (Purification and Preparation for the Journey)': ['5:1–4 (The Purity of the Camp)', '5:5–10 (Restitution for Wrongs)', '5:11–31 (The Test for an Unfaithful Wife)', '6:1–21 (The Nazirite Vow)', '6:22–27 (The Priestly Blessing)', '7 (Offerings from the Leaders)', '8:1–4 (Setting Up the Lamps)', '8:5–26 (The Setting Apart of the Levites)', '9:1–14 (The Second Passover)', '9:15–23 (The Cloud Above the Tabernacle)', '10:1–10 (The Silver Trumpets)'],
    '5:1–4 (The Purity of the Camp)': [],
    '5:5–10 (Restitution for Wrongs)': [],
    '5:11–31 (The Test for an Unfaithful Wife)': [],
    '6:1–21 (The Nazirite Vow)': [],
    '6:22–27 (The Priestly Blessing)': ['Num 6:24', 'Num 6:25', 'Num 6:26'],
    'Num 6:24': [],
    'Num 6:25': [],
    'Num 6:26': [],
    '7 (Offerings from the Leaders)': [],
    '8:1–4 (Setting Up the Lamps)': [],
    '8:5–26 (The Setting Apart of the Levites)': [],
    '9:1–14 (The Second Passover)': [],
    '9:15–23 (The Cloud Above the Tabernacle)': [],
    '10:1–10 (The Silver Trumpets)': [],
    '10:11–14 (Departure from Sinai and the Rebellion at Kadesh)': [],
    '15–19 (Laws and Rebellions in the Wilderness)': [],
    '20–25 (The Journey from Kadesh to Moab)': ['20:1–13 (Water from the Rock at Meribah)', '20:14–29 (Edom\'s Refusal and the Death of Aaron)', '21:1–9 (Victory at Hormah and the Bronze Snake)', '21:21–35 (The Defeat of Sihon and Og)', '22–24 (Balak and Balaam)', '25 (Apostasy at Shittim)'],
    '20:1–13 (Water from the Rock at Meribah)': ['Num 20:12'],
    'Num 20:12': [],
    '20:14–29 (Edom\'s Refusal and the Death of Aaron)': [],
    '21:1–9 (Victory at Hormah and the Bronze Snake)': [],
    '21:21–35 (The Defeat of Sihon and Og)': [],
    '22–24 (Balak and Balaam)': [],
    '25 (Apostasy at Shittim)': ['Num 25:6', 'Num 25:7', 'Num 25:8', 'Num 25:9'],
    'Num 25:6': [],
    'Num 25:7': [],
    'Num 25:8': [],
    'Num 25:9': [],
    '26–30 (The Second Census and New Regulations)': [],
    '31–36 (Preparation to Enter the Promised Land)': [],

    // Deuteronomy
    'Deuteronomy': ['1–4:43 (Historical Prologue)', '4:44–26 (The Exposition of the Law)', '27–28 (Blessings and Curses)', '29–30 (The Covenant in Moab)', '31–34 (The Final Days of Moses)'],
    '1–4:43 (Historical Prologue)': [],
    '4:44–26 (The Exposition of the Law)': ['4:44–49 (Introduction to the Second Address)', '5 (The Ten Commandments)', '6–11 (The Primary Commandment: Loving God)', '12–16:17 (Ceremonial and Ritual Laws)', '16:18–18 (Civil and Religious Authorities)', '19–25 (Social and Criminal Statutes)', '26 (The Liturgical Conclusion)'],
    '4:44–49 (Introduction to the Second Address)': [],
    '5 (The Ten Commandments)': ['5:1–5 (The Introduction to the Covenant)', '5:6–21 (The Ten Commandments)', '5:22–27 (The People\'s Fear at Horeb)', '5:28–33 (The Lord\'s Response and Moses\' Charge)'],
    '5:1–5 (The Introduction to the Covenant)': [],
    '5:6–21 (The Ten Commandments)': ['Deut 5:7', 'Deut 5:8', 'Deut 5:9'],
    'Deut 5:7': [],
    'Deut 5:8': [],
    'Deut 5:9': [],
    '5:22–27 (The People\'s Fear at Horeb)': [],
    '5:28–33 (The Lord\'s Response and Moses\' Charge)': [],
    '6–11 (The Primary Commandment: Loving God)': [],
    '12–16:17 (Ceremonial and Ritual Laws)': ['12 (The One Place of Worship)', '13 (Warning Against Idolatry)', '14:1–21 (Clean and Unclean Food)', '14:22–15 (Tithes, Debts, and Firstborns)', '16:1–17 (The Three Main Festivals)'],
    '12 (The One Place of Worship)': [],
    '13 (Warning Against Idolatry)': ['Deut 13:6', 'Deut 13:7', 'Deut 13:8', 'Deut 13:9'],
    'Deut 13:6': [],
    'Deut 13:7': [],
    'Deut 13:8': [],
    'Deut 13:9': [],
    '14:1–21 (Clean and Unclean Food)': [],
    '14:22–15 (Tithes, Debts, and Firstborns)': [],
    '16:1–17 (The Three Main Festivals)': [],
    '16:18–18 (Civil and Religious Authorities)': [],
    '19–25 (Social and Criminal Statutes)': ['19:1–13 (Cities of Refuge)', '19:14 (Property Landmarks)', '19:15–21 (Laws Concerning Witnesses)', '20 (Laws of Warfare)', '21:1–9 (Atonement for Unsolved Murders)', '21:10–25:19 (Miscellaneous Civil and Domestic Laws)'],
    '19:1–13 (Cities of Refuge)': [],
    '19:14 (Property Landmarks)': [],
    '19:15–21 (Laws Concerning Witnesses)': [],
    '20 (Laws of Warfare)': [],
    '21:1–9 (Atonement for Unsolved Murders)': [],
    '21:10–25:19 (Miscellaneous Civil and Domestic Laws)': ['21:10–14 (Marriage to a Captive Woman)', '21:15–17 (Rights of the Firstborn)', '21:18–21 (The Rebellious Son)', '21:22–23 (Burial of a Hanged Man)', '22:1–4 (Assisting a Neighbor\'s Livestock)', '22:5 (Prohibition of Cross-Dressing)', '22:6–7 (Protecting a Mother Bird)', '22:8 (Safety Parapets on Roofs)', '22:9–12 (Laws of Prohibited Mixtures)', '22:13–30 (Sexual Purity and Marriage)', '23:1–8 (Exclusion from the Assembly)', '23:9–14 (Camp Holiness and Hygiene)', '23:15–25 (Social and Economic Protections)', '24:1–4 (Divorce and New Marriage)', '24:5–22 (Justice for the Vulnerable)', '25:1–4 (Flogging Limits and Care for Animals)', '25:5–10 (Levirate Marriage)', '25:13–16 (Honest Weights and Measures)', '25:17–19 (The Command to Blot Out Amalek)'],
    '21:10–14 (Marriage to a Captive Woman)': [],
    '21:15–17 (Rights of the Firstborn)': [],
    '21:18–21 (The Rebellious Son)': [],
    '21:22–23 (Burial of a Hanged Man)': ['Deut 21:23'],
    'Deut 21:23': [],
    '22:1–4 (Assisting a Neighbor\'s Livestock)': [],
    '22:5 (Prohibition of Cross-Dressing)': [],
    '22:6–7 (Protecting a Mother Bird)': [],
    '22:8 (Safety Parapets on Roofs)': [],
    '22:9–12 (Laws of Prohibited Mixtures)': [],
    '22:13–30 (Sexual Purity and Marriage)': [],
    '23:1–8 (Exclusion from the Assembly)': [],
    '23:9–14 (Camp Holiness and Hygiene)': [],
    '23:15–25 (Social and Economic Protections)': [],
    '24:1–4 (Divorce and New Marriage)': [],
    '24:5–22 (Justice for the Vulnerable)': [],
    '25:1–4 (Flogging Limits and Care for Animals)': [],
    '25:5–10 (Levirate Marriage)': [],
    '25:13–16 (Honest Weights and Measures)': [],
    '25:17–19 (The Command to Blot Out Amalek)': [],
    '26 (The Liturgical Conclusion)': [],
    '27–28 (Blessings and Curses)': ['27:1–8 (The Altar on Mount Ebal)', '27:11–26 (Curses from Mount Ebal)', '28:1–14 (Blessings for Obedience)', '28:15–44 (Curses for Disobedience)', '28:45–68 (The Ultimate Curse: Exile)'],
    '27:1–8 (The Altar on Mount Ebal)': [],
    '27:11–26 (Curses from Mount Ebal)': [],
    '28:1–14 (Blessings for Obedience)': [],
    '28:15–44 (Curses for Disobedience)': [],
    '28:45–68 (The Ultimate Curse: Exile)': ['Deut 28:53'],
    'Deut 28:53': [],
    '29–30 (The Covenant in Moab)': [],
    '31–34 (The Final Days of Moses)': ['31:1–8 (Joshua Commissioned as Successor)', '31:9–29 (The Law and the Future Rebellion)', '32:1–43 (The Song of Moses)', '32:44–52 (Moses\' Final Command and Fate)', '33 (The Blessing of Moses)', '34 (The Death and Legacy of Moses)'],
    '31:1–8 (Joshua Commissioned as Successor)': [],
    '31:9–29 (The Law and the Future Rebellion)': [],
    '32:1–43 (The Song of Moses)': ['Deut 32:41', 'Deut 32:42'],
    'Deut 32:41': [],
    'Deut 32:42': [],
    '32:44–52 (Moses\' Final Command and Fate)': [],
    '33 (The Blessing of Moses)': [],
    '34 (The Death and Legacy of Moses)': [],
    'Prophetic Books': ['The Major Prophets', 'The Minor Prophets (The Twelve)'],

    // Major Prophets
    'The Major Prophets': ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel'],

    // Isaiah
    'Isaiah': ['1–35 (Judgment and Promise)', '36–39 (Historical Interlude)', '40–48 (Deliverance for Exiles)', '49–57 (The Servant\'s Ministry)', '58–66 (Final Glory)'],
    '1–35 (Judgment and Promise)': ['1 (The Great Arraignment)', '2–4 (The Mountain of the Lord and the Day of Judgment)', '5 (The Song of the Vineyard and Six Woes)', '6 (Isaiah\'s Call and Commission)', '7:1–9:7 (The Book of Immanuel)', '9:8–10:34 (Judgment on Israel and Assyria)', '11–12 (The Righteous Branch and the Song of Trust)', '13:1–23:18 (Oracles Against the Nations)', '24:1–27:13 (The Little Apocalypse)', '28:1–33:24 (The Six Woes Concerning Israel and Judah)', '34:1–35:10 (The Desert Blooms and the Ransomed Return)'],
    '1 (The Great Arraignment)': ['Isaiah 1:18'],
    'Isaiah 1:18': [],
    '2–4 (The Mountain of the Lord and the Day of Judgment)': ['2:1–4 (The Mountain of the Lord)', '2:6–22 (The Day of the Lord)', '3:1–15 (The Collapse of Society)', '3:16–4:1 (The Judgment on the Daughters of Zion)', '4:2–6 (The Branch of the Lord)'],
    '2:1–4 (The Mountain of the Lord)': ['Isaiah 2:4'],
    'Isaiah 2:4': [],
    '2:6–22 (The Day of the Lord)': [],
    '3:1–15 (The Collapse of Society)': [],
    '3:16–4:1 (The Judgment on the Daughters of Zion)': [],
    '4:2–6 (The Branch of the Lord)': [],
    '5 (The Song of the Vineyard and Six Woes)': [],
    '6 (Isaiah\'s Call and Commission)': [],
    '7:1–9:7 (The Book of Immanuel)': [],
    '9:8–10:34 (Judgment on Israel and Assyria)': [],
    '11–12 (The Righteous Branch and the Song of Trust)': [],
    '13:1–23:18 (Oracles Against the Nations)': ['13:1–14:23 (The Oracle Against Babylon)', '14:24–27 (The Oracle Against Assyria)', '14:28–32 (The Oracle Against Philistia)', '15:1–16:14 (The Oracle Against Moab)', '17 (The Oracle Against Damascus and Israel)', '18 (The Oracle Against Cush/Ethiopia)', '19 (The Oracle Against Egypt)', '20 (The Sign Against Egypt and Cush)', '21 (The Oracles Against the Desert, Dumah, and Arabia)', '22 (The Oracle Against the Valley of Vision)', '23 (The Oracle Against Tyre and Sidon)'],
    '13:1–14:23 (The Oracle Against Babylon)': ['13:1–8 (The Call to Arms)', '13:9–16 (The Day of the Lord)', '13:17–22 (The Medes and the Desolation of Babylon)', '14:1–2 (The Restoration of Israel)', '14:3–11 (The Taunt Against the King of Babylon)', '14:12–15 (The Fall of the Day Star)', '14:16–21 (The Unburied Corpse)', '14:22–23 (The Final Erasure)'],
    '13:1–8 (The Call to Arms)': ['Isaiah 13:1'],
    'Isaiah 13:1': [],
    '13:9–16 (The Day of the Lord)': ['Isaiah 13:10'],
    'Isaiah 13:10': [],
    '13:17–22 (The Medes and the Desolation of Babylon)': [],
    '14:1–2 (The Restoration of Israel)': [],
    '14:3–11 (The Taunt Against the King of Babylon)': [],
    '14:12–15 (The Fall of the Day Star)': [],
    '14:16–21 (The Unburied Corpse)': [],
    '14:22–23 (The Final Erasure)': [],
    '14:24–27 (The Oracle Against Assyria)': [],
    '14:28–32 (The Oracle Against Philistia)': [],
    '15:1–16:14 (The Oracle Against Moab)': [],
    '17 (The Oracle Against Damascus and Israel)': [],
    '18 (The Oracle Against Cush/Ethiopia)': [],
    '19 (The Oracle Against Egypt)': ['19:1–10 (A Prophecy Against Egypt)', '19:16–17 (The Terror of Judah)', '19:18–22 (Egypt\'s Conversion to the Lord)', '19:23–25 (A Highway of Blessing)'],
    '19:1–10 (A Prophecy Against Egypt)': [],
    '19:16–17 (The Terror of Judah)': [],
    '19:18–22 (Egypt\'s Conversion to the Lord)': [],
    '19:23–25 (A Highway of Blessing)': ['Isaiah 19:24', 'Isaiah 19:25'],
    'Isaiah 19:24': [],
    'Isaiah 19:25': [],
    '20 (The Sign Against Egypt and Cush)': [],
    '21 (The Oracles Against the Desert, Dumah, and Arabia)': [],
    '22 (The Oracle Against the Valley of Vision)': [],
    '23 (The Oracle Against Tyre and Sidon)': [],
    '24:1–27:13 (The Little Apocalypse)': [],
    '28:1–33:24 (The Six Woes Concerning Israel and Judah)': [],
    '34:1–35:10 (The Desert Blooms and the Ransomed Return)': [],
    '36–39 (Historical Interlude)': ['36 (Sennacherib Invades Judah)', '37:1–20 (Hezekiah\'s Prayer)', '37:21–38 (The Fall of the Assyrians)', '38:1–8 (Hezekiah\'s Sickness and Healing)', '38:9–22 (Hezekiah\'s Song of Thanksgiving)', '39 (Envoys from Babylon)'],
    '36 (Sennacherib Invades Judah)': [],
    '37:1–20 (Hezekiah\'s Prayer)': [],
    '37:21–38 (The Fall of the Assyrians)': ['Isaiah 37:36'],
    'Isaiah 37:36': [],
    '38:1–8 (Hezekiah\'s Sickness and Healing)': [],
    '38:9–22 (Hezekiah\'s Song of Thanksgiving)': [],
    '39 (Envoys from Babylon)': [],
    '40–48 (Deliverance for Exiles)': ['40:1–11 (The Proclamation of Comfort)', '40:12–31 (The Incomparable Creator)', '41 (The Helper of Israel)', '42:1–9 (The First Servant Song)', '42:10–25 (A New Song of Praise and a Rebuked People)', '43:1–44:5 (Israel\'s Only Savior)', '44:6–28 (The Folly of Idolatry)', '44:24–45:25 (The Commission of Cyrus)', '46 (Bel Bows Down)', '47 (The Fall of Babylon)', '48 (Refined for God\'s Glory)'],
    '40:1–11 (The Proclamation of Comfort)': [],
    '40:12–31 (The Incomparable Creator)': [],
    '41 (The Helper of Israel)': [],
    '42:1–9 (The First Servant Song)': [],
    '42:10–25 (A New Song of Praise and a Rebuked People)': [],
    '43:1–44:5 (Israel\'s Only Savior)': ['43:1–7 (Israel\'s Only Savior)', '43:8–13 (Witnesses to God\'s Sovereignty)', '43:14–21 (God\'s Mercy and Forgiveness)', '43:22–28 (Israel\'s Sin and God\'s Forgiveness)', '44:1–5 (The Blessing on Israel)'],
    '43:1–7 (Israel\'s Only Savior)': ['Isaiah 43:1'],
    'Isaiah 43:1': [],
    '43:8–13 (Witnesses to God\'s Sovereignty)': [],
    '43:14–21 (God\'s Mercy and Forgiveness)': [],
    '43:22–28 (Israel\'s Sin and God\'s Forgiveness)': [],
    '44:1–5 (The Blessing on Israel)': [],
    '44:6–28 (The Folly of Idolatry)': [],
    '44:24–45:25 (The Commission of Cyrus)': ['Isaiah 45:5'],
    'Isaiah 45:5': [],
    '46 (Bel Bows Down)': [],
    '47 (The Fall of Babylon)': [],
    '48 (Refined for God\'s Glory)': [],
    '49–57 (The Servant\'s Ministry)': ['49:1–13 (The Second Servant Song)', '49:14–50:3 (Zion\'s Children Restored)', '50:4–11 (The Third Servant Song)', '51:1–52:12 (A Call to Trust and Awake)', '52:13–53:12 (The Fourth Servant Song)', '54 (The Eternal Covenant of Peace)', '55 (An Invitation to the Thirsty)', '56:1–8 (Salvation for the Outsider)', '56:9–57:13 (Rebuking the Wicked Leaders)', '57:14–21 (Comfort for the Humble)'],
    '49:1–13 (The Second Servant Song)': [],
    '49:14–50:3 (Zion\'s Children Restored)': [],
    '50:4–11 (The Third Servant Song)': [],
    '51:1–52:12 (A Call to Trust and Awake)': [],
    '52:13–53:12 (The Fourth Servant Song)': ['52:13–15 (The Servant\'s Surprising Success)', '53:1–3 (The Servant\'s Lowly Origins and Rejection)', '53:4–6 (The Servant\'s Substitutionary Suffering)', '53:7–9 (The Servant\'s Silent Submission and Death)', '53:10–12 (The Servant\'s Final Vindication and Reward)'],
    '52:13–15 (The Servant\'s Surprising Success)': [],
    '53:1–3 (The Servant\'s Lowly Origins and Rejection)': ['Isaiah 53:3'],
    'Isaiah 53:3': [],
    '53:4–6 (The Servant\'s Substitutionary Suffering)': ['Isaiah 53:4', 'Isaiah 53:5', 'Isaiah 53:6'],
    'Isaiah 53:4': [],
    'Isaiah 53:5': [],
    'Isaiah 53:6': [],
    '53:7–9 (The Servant\'s Silent Submission and Death)': [],
    '53:10–12 (The Servant\'s Final Vindication and Reward)': [],
    '54 (The Eternal Covenant of Peace)': [],
    '55 (An Invitation to the Thirsty)': ['55:1–5 (An Invitation to the Thirsty)', '55:6–9 (The Call to Repentance)', '55:10–11 (The Power of God\'s Word)', '55:12–13 (The Joyful Return of Nature)'],
    '55:1–5 (An Invitation to the Thirsty)': [],
    '55:6–9 (The Call to Repentance)': ['Isaiah 55:8', 'Isaiah 55:9'],
    'Isaiah 55:8': [],
    'Isaiah 55:9': [],
    '55:10–11 (The Power of God\'s Word)': [],
    '55:12–13 (The Joyful Return of Nature)': [],
    '56:1–8 (Salvation for the Outsider)': [],
    '56:9–57:13 (Rebuking the Wicked Leaders)': ['56:9–12 (The Blind Watchmen)', '57:1–2 (The Death of the Righteous)', '57:3–10 (The Idolatry of the Rebels)', '57:11–13 (The Failure of False Gods)'],
    '56:9–12 (The Blind Watchmen)': ['Isaiah 56:10'],
    'Isaiah 56:10': [],
    '57:1–2 (The Death of the Righteous)': [],
    '57:3–10 (The Idolatry of the Rebels)': [],
    '57:11–13 (The Failure of False Gods)': [],
    '57:14–21 (Comfort for the Humble)': [],
    '58–66 (Final Glory)': [],

    // Jeremiah
    'Jeremiah': ['1 (The Prophet\'s Call)', '2–6 (Early Oracles Against Judah and Jerusalem)', '7–10 (The Temple Sermon and Idolatry)', '11–20 (Jeremiah\'s Struggles and Confessions)', '21–25 (Judgment on Kings and Prophets)', '26–29 (Conflict with False Prophets)', '30–33 (The Book of Consolation)', '34–45 (The Fall of Jerusalem)', '46–51 (Oracles Against the Foreign Nations)', '52 (Historical Appendix)'],
    '1 (The Prophet\'s Call)': ['1:1–3 (Superscription)', '1:4–10 (The Call of Jeremiah)', '1:11–12 (The Vision of the Almond Branch)', '1:13–16 (The Vision of the Boiling Pot)', '1:17–19 (The Promise of Protection)'],
    '1:1–3 (Superscription)': [],
    '1:4–10 (The Call of Jeremiah)': ['Jeremiah 1:5'],
    'Jeremiah 1:5': [],
    '1:11–12 (The Vision of the Almond Branch)': [],
    '1:13–16 (The Vision of the Boiling Pot)': [],
    '1:17–19 (The Promise of Protection)': [],
    '2–6 (Early Oracles Against Judah and Jerusalem)': [],
    '7–10 (The Temple Sermon and Idolatry)': [],
    '11–20 (Jeremiah\'s Struggles and Confessions)': ['11 (The Broken Covenant)', '12 (Jeremiah\'s Complaint and God\'s Answer)', '13 (The Linen Belt and the Wine Jars)', '14–15 (The Drought and Rejection)', '16 (The Prophet\'s Lifestyle as a Sign)', '17 (The Heart\'s Deceit and the Sabbath)', '18 (The Potter\'s House)', '19 (The Broken Earthenware Jar)', '20 (Conflict with Pashhur and a Final Lament)'],
    '11 (The Broken Covenant)': [],
    '12 (Jeremiah\'s Complaint and God\'s Answer)': [],
    '13 (The Linen Belt and the Wine Jars)': [],
    '14–15 (The Drought and Rejection)': [],
    '16 (The Prophet\'s Lifestyle as a Sign)': [],
    '17 (The Heart\'s Deceit and the Sabbath)': ['1–4 (Judah\'s Indelible Sin)', '5–8 (The Two Ways)', '9–11 (The Deceitful Heart)', '12–18 (Jeremiah\'s Prayer for Healing)', '19–27 (Hallowing the Sabbath)'],
    '1–4 (Judah\'s Indelible Sin)': ['Jeremiah 17:4'],
    'Jeremiah 17:4': [],
    '5–8 (The Two Ways)': [],
    '9–11 (The Deceitful Heart)': ['Jeremiah 17:9'],
    'Jeremiah 17:9': [],
    '12–18 (Jeremiah\'s Prayer for Healing)': ['Jeremiah 17:13'],
    'Jeremiah 17:13': [],
    '19–27 (Hallowing the Sabbath)': [],
    '18 (The Potter\'s House)': [],
    '19 (The Broken Earthenware Jar)': [],
    '20 (Conflict with Pashhur and a Final Lament)': ['Jeremiah 20:7'],
    'Jeremiah 20:7': [],
    '21–25 (Judgment on Kings and Prophets)': [],
    '26–29 (Conflict with False Prophets)': ['26 (The Temple Sermon and Jeremiah\'s Arrest)', '27 (The Symbolic Yoke)', '28 (The Confrontation with Hananiah)', '29 (A Letter to the Exiles)'],
    '26 (The Temple Sermon and Jeremiah\'s Arrest)': [],
    '27 (The Symbolic Yoke)': [],
    '28 (The Confrontation with Hananiah)': [],
    '29 (A Letter to the Exiles)': ['29:1–9 (Instructions to the Exiles)', '29:10–14 (The Promise of Restoration)', '29:15–20 (Judgment on Those Remaining)', '29:21–23 (The Fate of Ahab and Zedekiah)', '29:24–32 (The Message to Shemaiah)'],
    '29:1–9 (Instructions to the Exiles)': ['Jeremiah 29:7'],
    'Jeremiah 29:7': [],
    '29:10–14 (The Promise of Restoration)': [],
    '29:15–20 (Judgment on Those Remaining)': [],
    '29:21–23 (The Fate of Ahab and Zedekiah)': [],
    '29:24–32 (The Message to Shemaiah)': [],
    '30–33 (The Book of Consolation)': ['30 (The Restoration of Israel and Judah)', '31 (The New Covenant)', '32 (The Purchase of the Field)', '33 (The Branch of Righteousness)'],
    '30 (The Restoration of Israel and Judah)': [],
    '31 (The New Covenant)': ['31:1–6 (The Restoration of Israel)', '31:7–14 (The Joyful Return of the Exiles)', '31:15–22 (Rachel Weeping for Her Children)', '31:23–30 (Individual Responsibility)', '31:31–34 (The New Covenant)', '31:35–40 (The Eternal Nature of the Covenant)'],
    '31:1–6 (The Restoration of Israel)': [],
    '31:7–14 (The Joyful Return of the Exiles)': [],
    '31:15–22 (Rachel Weeping for Her Children)': [],
    '31:23–30 (Individual Responsibility)': [],
    '31:31–34 (The New Covenant)': ['Jeremiah 31:31', 'Jeremiah 31:32', 'Jeremiah 31:33', 'Jeremiah 31:34'],
    'Jeremiah 31:31': [],
    'Jeremiah 31:32': [],
    'Jeremiah 31:33': [],
    'Jeremiah 31:34': [],
    '31:35–40 (The Eternal Nature of the Covenant)': [],
    '32 (The Purchase of the Field)': [],
    '33 (The Branch of Righteousness)': [],
    '34–45 (The Fall of Jerusalem)': [],
    '46–51 (Oracles Against the Foreign Nations)': [],
    '52 (Historical Appendix)': [],

    // Lamentations
    'Lamentations': ['1 (The Desolation of Jerusalem)', '2 (The Wrath of God)', '3 (The Man of Affliction and Hope)', '4 (The Horrors of the Siege)', '5 (A Prayer for Restoration)'],
    '1 (The Desolation of Jerusalem)': [],
    '2 (The Wrath of God)': [],
    '3 (The Man of Affliction and Hope)': [],
    '4 (The Horrors of the Siege)': [],
    '5 (A Prayer for Restoration)': [],

    // Ezekiel
    'Ezekiel': ['1–3 (The Vision of God\'s Glory and Ezekiel\'s Call)', '4–5 (Signs of the Coming Siege)', '6–7 (Prophecies Against the Land and People)', '8–11 (The Abominations in the Temple and the Departure of Glory)', '12–24 (Signs and Parables of Judgment)', '25–32 (Oracles Against the Nations)', '33 (The Watchman and the Fall of Jerusalem)', '34–37 (The Good Shepherd and the Valley of Dry Bones)', '38–39 (The Prophecy Against Gog of Magog)', '40–48 (The Vision of the New Temple and Land)'],
    '1–3 (The Vision of God\'s Glory and Ezekiel\'s Call)': [],
    '4–5 (Signs of the Coming Siege)': [],
    '6–7 (Prophecies Against the Land and People)': [],
    '8–11 (The Abominations in the Temple and the Departure of Glory)': [],
    '12–24 (Signs and Parables of Judgment)': [],
    '25–32 (Oracles Against the Nations)': ['25:1–7 (Prophecy Against Ammon)', '25:8–11 (Prophecy Against Moab)', '25:12–14 (Prophecy Against Edom)', '25:15–17 (Prophecy Against Philistia)', '26 (Prophecy Against Tyre)', '27 (A Lament for Tyre)', '28:1–10 (Prophecy Against the King of Tyre)', '28:11–19 (A Lament for the King of Tyre)', '28:20–26 (Prophecy Against Sidon and a Promise for Israel)', '29:1–16 (Prophecy Against Egypt and Pharaoh)', '29:17–21 (Egypt as Wages for Nebuchadnezzar)', '30:1–19 (A Lament for Egypt)', '30:20–26 (Pharaoh\'s Broken Arms)', '31 (The Cedar in Lebanon)', '32:1–16 (A Lament for Pharaoh)', '32:17–32 (Egypt in the Realm of the Dead)'],
    '25:1–7 (Prophecy Against Ammon)': [],
    '25:8–11 (Prophecy Against Moab)': [],
    '25:12–14 (Prophecy Against Edom)': [],
    '25:15–17 (Prophecy Against Philistia)': [],
    '26 (Prophecy Against Tyre)': [],
    '27 (A Lament for Tyre)': [],
    '28:1–10 (Prophecy Against the King of Tyre)': [],
    '28:11–19 (A Lament for the King of Tyre)': ['Ezekiel 28:15', 'Ezekiel 28:16', 'Ezekiel 28:17'],
    'Ezekiel 28:15': [],
    'Ezekiel 28:16': [],
    'Ezekiel 28:17': [],
    '28:20–26 (Prophecy Against Sidon and a Promise for Israel)': [],
    '29:1–16 (Prophecy Against Egypt and Pharaoh)': [],
    '29:17–21 (Egypt as Wages for Nebuchadnezzar)': [],
    '30:1–19 (A Lament for Egypt)': [],
    '30:20–26 (Pharaoh\'s Broken Arms)': [],
    '31 (The Cedar in Lebanon)': [],
    '32:1–16 (A Lament for Pharaoh)': [],
    '32:17–32 (Egypt in the Realm of the Dead)': [],
    '33 (The Watchman and the Fall of Jerusalem)': [],
    '34–37 (The Good Shepherd and the Valley of Dry Bones)': [],
    '38–39 (The Prophecy Against Gog of Magog)': [],
    '40–48 (The Vision of the New Temple and Land)': [],

    // Daniel
    'Daniel': ['1 (Daniel and the Three Friends)', '2–6 (The Court Tales and God\'s Sovereignty)', '7 (The Vision of the Four Beasts)', '8–9 (The Ram, the Goat, and the Seventy Weeks)', '10–12 (The Final Vision and the End of Days)'],
    '1 (Daniel and the Three Friends)': [],
    '2–6 (The Court Tales and God\'s Sovereignty)': ['2 (Nebuchadnezzar\'s Dream of the Statue)', '3 (The Fiery Furnace)', '4 (The Humbling of Nebuchadnezzar)', '5 (Belshazzar\'s Feast and the Writing on the Wall)', '6 (Daniel in the Lions\' Den)'],
    '2 (Nebuchadnezzar\'s Dream of the Statue)': [],
    '3 (The Fiery Furnace)': ['Daniel 3:25'],
    'Daniel 3:25': [],
    '4 (The Humbling of Nebuchadnezzar)': [],
    '5 (Belshazzar\'s Feast and the Writing on the Wall)': [],
    '6 (Daniel in the Lions\' Den)': [],
    '7 (The Vision of the Four Beasts)': [],
    '8–9 (The Ram, the Goat, and the Seventy Weeks)': ['8:1–14 (The Vision of the Ram and the Goat)', '8:15–27 (The Interpretation by Gabriel)', '9:1–19 (Daniel\'s Prayer of Confession)', '9:20–23 (The Arrival of Gabriel)', '9:24–27 (The Prophecy of the Seventy Weeks)'],
    '8:1–14 (The Vision of the Ram and the Goat)': [],
    '8:15–27 (The Interpretation by Gabriel)': [],
    '9:1–19 (Daniel\'s Prayer of Confession)': [],
    '9:20–23 (The Arrival of Gabriel)': [],
    '9:24–27 (The Prophecy of the Seventy Weeks)': ['Daniel 9:26'],
    'Daniel 9:26': [],
    '10–12 (The Final Vision and the End of Days)': ['10:1–11:1 (Daniel\'s Vision by the Tigris)', '11:2–20 (Prophecies of Persia and Greece)', '11:21–35 (The Rise of a Contemptible King)', '11:36–45 (The Self-Exalting King)', '12:1–3 (The Time of the End and Resurrection)', '12:4–13 (The Sealing of the Prophecy)'],
    '10:1–11:1 (Daniel\'s Vision by the Tigris)': [],
    '11:2–20 (Prophecies of Persia and Greece)': [],
    '11:21–35 (The Rise of a Contemptible King)': [],
    '11:36–45 (The Self-Exalting King)': ['Daniel 11:45'],
    'Daniel 11:45': [],
    '12:1–3 (The Time of the End and Resurrection)': [],
    '12:4–13 (The Sealing of the Prophecy)': [],

    // Minor Prophets
    'The Minor Prophets (The Twelve)': ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'],
    'Hosea': ['1:1–3:5 (The Marriage of Hosea and Gomer)', '4:1–10:15 (The Indictment and Judgment of Israel)', '11 (The Compassion of a Father)', '12:1–13:16 (Israel\'s Persistent Rebellion)', '14 (A Call to Repentance and Promise of Healing)'],
    '1:1–3:5 (The Marriage of Hosea and Gomer)': [],
    '4:1–10:15 (The Indictment and Judgment of Israel)': [],
    '11 (The Compassion of a Father)': [],
    '12:1–13:16 (Israel\'s Persistent Rebellion)': [],
    '14 (A Call to Repentance and Promise of Healing)': [],
    'Joel': ['1 (The Plague of Locusts)', '2:1–11 (The Coming Day of the Lord)', '2:12–17 (A Call to Heartfelt Repentance)', '2:18–32 (The Promise of Restoration and the Outpouring of the Spirit)', '3 (The Judgment of the Nations)'],
    '1 (The Plague of Locusts)': [],
    '2:1–11 (The Coming Day of the Lord)': [],
    '2:12–17 (A Call to Heartfelt Repentance)': [],
    '2:18–32 (The Promise of Restoration and the Outpouring of the Spirit)': [],
    '3 (The Judgment of the Nations)': [],
    'Amos': ['1:1–2:16 (Judgment on the Nations and Israel)', '3:1–6:14 (Indictments of Social Injustice)', '7:1–9:10 (Five Visions of Judgment)', '9 (The Promise of Future Restoration)'],
    '1:1–2:16 (Judgment on the Nations and Israel)': [],
    '3:1–6:14 (Indictments of Social Injustice)': ['3 (The Prophet\'s Responsibility and Samaria\'s Doom)', '4:1–3 (The Cows of Bashan)', '4:4–13 (Failure to Learn from Judgment)', '5:1–15 (A Lament and a Call to Seek Good)', '5:16–27 (The Day of the Lord and the Rejection of Ritual)', '6 (The Complacency of the Elite)'],
    '3 (The Prophet\'s Responsibility and Samaria\'s Doom)': [],
    '4:1–3 (The Cows of Bashan)': [],
    '4:4–13 (Failure to Learn from Judgment)': [],
    '5:1–15 (A Lament and a Call to Seek Good)': [],
    '5:16–27 (The Day of the Lord and the Rejection of Ritual)': ['Amos 5:26'],
    'Amos 5:26': [],
    '6 (The Complacency of the Elite)': [],
    '7:1–9:10 (Five Visions of Judgment)': [],
    '9 (The Promise of Future Restoration)': [],
    'Obadiah': ['1:1–9 (The Judgment of Edom)', '1:10–14 (Edom\'s Crimes Against Israel)', '1:15–16 (The Day of the Lord for All Nations)', '1:17–21 (The Restoration of Israel)'],
    '1:1–9 (The Judgment of Edom)': [],
    '1:10–14 (Edom\'s Crimes Against Israel)': [],
    '1:15–16 (The Day of the Lord for All Nations)': [],
    '1:17–21 (The Restoration of Israel)': [],
    'Jonah': ['1 (The Prophet\'s Disobedience and the Great Fish)', '2 (Jonah\'s Prayer from the Deep)', '3 (The Conversion of Nineveh)', '4 (Jonah\'s Anger and God\'s Compassion)'],
    '1 (The Prophet\'s Disobedience and the Great Fish)': [],
    '2 (Jonah\'s Prayer from the Deep)': [],
    '3 (The Conversion of Nineveh)': [],
    '4 (Jonah\'s Anger and God\'s Compassion)': [],
    'Micah': ['1:1–2:13 (Judgment on Samaria and Judah)', '3:1–5:15 (The Contrast of Leaders and the Future King)', '6:1–7:7 (The Lord\'s Indictment and Israel\'s Corruption)', '7:8–20 (A Prayer of Confidence and Divine Forgiveness)'],
    '1:1–2:13 (Judgment on Samaria and Judah)': [],
    '3:1–5:15 (The Contrast of Leaders and the Future King)': [],
    '6:1–7:7 (The Lord\'s Indictment and Israel\'s Corruption)': [],
    '7:8–20 (A Prayer of Confidence and Divine Forgiveness)': ['Micah 7:18'],
    'Micah 7:18': [],
    'Nahum': ['1 (The Majesty of God in Judgment)', '2 (The Siege and Fall of Nineveh)', '3 (The Reasons for Nineveh\'s Ruin)'],
    '1 (The Majesty of God in Judgment)': ['Nahum 1:7'],
    'Nahum 1:7': [],
    '2 (The Siege and Fall of Nineveh)': [],
    '3 (The Reasons for Nineveh\'s Ruin)': [],
    'Habakkuk': ['1:1–11 (The Prophet\'s First Complaint and God\'s Answer)', '1:12–2:1 (The Prophet\'s Second Complaint)', '2:2–20 (The Five Woes Against the Oppressor)', '3 (Habakkuk\'s Prayer and Song of Trust)'],
    '1:1–11 (The Prophet\'s First Complaint and God\'s Answer)': [],
    '1:12–2:1 (The Prophet\'s Second Complaint)': [],
    '2:2–20 (The Five Woes Against the Oppressor)': [],
    '3 (Habakkuk\'s Prayer and Song of Trust)': [],
    'Zephaniah': ['1:1–2:3 (The Coming Day of the Lord)', '2:4–15 (Judgment Against the Surrounding Nations)', '3:1–7 (The Corruption of Jerusalem)', '3:8–20 (The Promise of Restoration and Joy)'],
    '1:1–2:3 (The Coming Day of the Lord)': [],
    '2:4–15 (Judgment Against the Surrounding Nations)': [],
    '3:1–7 (The Corruption of Jerusalem)': [],
    '3:8–20 (The Promise of Restoration and Joy)': [],
    'Haggai': ['1 (The Call to Rebuild the Temple)', '2:1–9 (The Promise of Greater Glory)', '2:10–19 (A Lesson on Holiness and Blessing)', '2:20–23 (The Signet Ring of Zerubbabel)'],
    '1 (The Call to Rebuild the Temple)': [],
    '2:1–9 (The Promise of Greater Glory)': [],
    '2:10–19 (A Lesson on Holiness and Blessing)': [],
    '2:20–23 (The Signet Ring of Zerubbabel)': [],
    'Zechariah': ['1:1–6 (A Call to Repentance)', '1:7–6:15 (The Eight Night Visions)', '7:1–8:23 (True Fasting and the Promise of Blessing)', '9:1–11:17 (The Coming King and the Rejected Shepherd)', '12:1–14:21 (The Final Battle and the Kingdom of God)'],
    '1:1–6 (A Call to Repentance)': [],
    '1:7–6:15 (The Eight Night Visions)': [],
    '7:1–8:23 (True Fasting and the Promise of Blessing)': [],
    '9:1–11:17 (The Coming King and the Rejected Shepherd)': [],
    '12:1–14:21 (The Final Battle and the Kingdom of God)': [],
    'Malachi': ['1:1–5 (God\'s Love for Israel)', '1:6–2:9 (The Corruption of the Priesthood)', '2:10–16 (Faithlessness in the Community)', '2:17–3:5 (The Coming Messenger and Judgment)', '3:6–12 (Robbing God)', '3:13–4:3 (The Book of Remembrance and the Sun of Righteousness)', '4:4–6 (The Final Admonition)'],
    '1:1–5 (God\'s Love for Israel)': [],
    '1:6–2:9 (The Corruption of the Priesthood)': [],
    '2:10–16 (Faithlessness in the Community)': [],
    '2:17–3:5 (The Coming Messenger and Judgment)': [],
    '3:6–12 (Robbing God)': [],
    '3:13–4:3 (The Book of Remembrance and the Sun of Righteousness)': [],
    '4:4–6 (The Final Admonition)': [],
    'Historical Books': ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'],
    'Joshua': ['1:1–5:12 (Entering the Promised Land)', '5:13–12:24 (The Conquest of Canaan)', '13:1–21:45 (The Allotment of the Land)', '22:1–24:33 (Joshua\'s Farewell and Covenant Renewal)'],
    '1:1–5:12 (Entering the Promised Land)': ['1:1–9 (The Commissioning of Joshua)', '1:10–18 (Preparation for the Crossing)', '2 (Rahab and the Spies)', '3 (Crossing the Jordan)', '4 (The Twelve Memorial Stones)', '5:1–9 (Circumcision at Gilgal)', '5:10–12 (The First Passover and the End of Manna)'],
    '1:1–9 (The Commissioning of Joshua)': ['Josh 1:9'],
    'Josh 1:9': [],
    '1:10–18 (Preparation for the Crossing)': [],
    '2 (Rahab and the Spies)': [],
    '3 (Crossing the Jordan)': ['Josh 3:16'],
    'Josh 3:16': [],
    '4 (The Twelve Memorial Stones)': [],
    '5:1–9 (Circumcision at Gilgal)': [],
    '5:10–12 (The First Passover and the End of Manna)': [],
    '5:13–12:24 (The Conquest of Canaan)': ['5:13–6 (The Fall of Jericho)', '7–8:29 (The Sin of Achan and the Conquest of Ai)', '8:30–35 (Covenant Renewal at Mount Ebal)', '9 (The Gibeonite Deception)', '10 (The Southern Campaign)', '11 (The Northern Campaign)', '12 (List of Defeated Kings)'],
    '5:13–6 (The Fall of Jericho)': [],
    '7–8:29 (The Sin of Achan and the Conquest of Ai)': [],
    '8:30–35 (Covenant Renewal at Mount Ebal)': [],
    '9 (The Gibeonite Deception)': [],
    '10 (The Southern Campaign)': ['Josh 10:39'],
    'Josh 10:39': [],
    '11 (The Northern Campaign)': [],
    '12 (List of Defeated Kings)': [],
    '13:1–21:45 (The Allotment of the Land)': [],
    '22:1–24:33 (Joshua\'s Farewell and Covenant Renewal)': [],
    'Judges': ['1–3:6 (The Cycle of Apostasy)', '3:7–31 (The Deliverance by the Judges)', '17–18 (The Idolatry of Micah and the Danites)', '19–21 (The Outrage at Gibeah and the Civil War)'],
    '1–3:6 (The Cycle of Apostasy)': [],
    '3:7–31 (The Deliverance by the Judges)': [],
    '17–18 (The Idolatry of Micah and the Danites)': [],
    '19–21 (The Outrage at Gibeah and the Civil War)': [],
    'Ruth': ['1 (Naomi and Ruth Return to Bethlehem)', '2 (Ruth Gleans in the Field of Boaz)', '3 (The Request at the Threshing Floor)', '4:1–12 (Boaz Redeems Ruth)', '4:13–22 (The Genealogy of David)'],
    '1 (Naomi and Ruth Return to Bethlehem)': [],
    '2 (Ruth Gleans in the Field of Boaz)': [],
    '3 (The Request at the Threshing Floor)': [],
    '4:1–12 (Boaz Redeems Ruth)': [],
    '4:13–22 (The Genealogy of David)': [],
    '1 Samuel': ['1–3 (The Birth and Calling of Samuel)', '4–7 (The Ark Narrative and Samuel\'s Judgeship)', '8–12 (The Establishment of the Monarchy)', '13–15 (The Rise and Fall of Saul)', '16–17 (The Anointing of David and Victory over Goliath)', '18–20 (The Friendship of Jonathan and Saul\'s Jealousy)', '21–26 (David\'s Life as a Fugitive)', '27–31 (The End of Saul\'s Reign)'],
    '1–3 (The Birth and Calling of Samuel)': [],
    '4–7 (The Ark Narrative and Samuel\'s Judgeship)': [],
    '8–12 (The Establishment of the Monarchy)': [],
    '13–15 (The Rise and Fall of Saul)': [],
    '16–17 (The Anointing of David and Victory over Goliath)': ['16:1–13 (David Anointed by Samuel)', '16:14–23 (David in Saul\'s Service)', '17:1–11 (Goliath\'s Challenge)', '17:32–40 (David Accepts the Challenge)', '17:41–54 (David Kills Goliath)'],
    '16:1–13 (David Anointed by Samuel)': [],
    '16:14–23 (David in Saul\'s Service)': [],
    '17:1–11 (Goliath\'s Challenge)': [],
    '17:32–40 (David Accepts the Challenge)': [],
    '17:41–54 (David Kills Goliath)': ['1Sam 17:57'],
    '1Sam 17:57': [],
    '18–20 (The Friendship of Jonathan and Saul\'s Jealousy)': [],
    '21–26 (David\'s Life as a Fugitive)': [],
    '27–31 (The End of Saul\'s Reign)': [],
    '2 Samuel': ['1 (David\'s Lament for Saul and Jonathan)', '2–4 (The Struggle Between David and the House of Saul)', '5–6 (David Becomes King and Brings the Ark to Jerusalem)', '7 (The Davidic Covenant)', '8–10 (David\'s Military Victories and Kindness to Mephibosheth)', '11–12 (David\'s Sin with Bathsheba and Its Consequences)', '13–14 (The Rebellion of Absalom Begins)', '15–19 (Absalom\'s Coup and David\'s Flight)', '20 (The Rebellion of Sheba)', '21–24 (Appendices to David\'s Reign)'],
    '1 (David\'s Lament for Saul and Jonathan)': [],
    '2–4 (The Struggle Between David and the House of Saul)': [],
    '5–6 (David Becomes King and Brings the Ark to Jerusalem)': [],
    '7 (The Davidic Covenant)': ['2Sam 7:28'],
    '2Sam 7:28': [],
    '8–10 (David\'s Military Victories and Kindness to Mephibosheth)': [],
    '11–12 (David\'s Sin with Bathsheba and Its Consequences)': [],
    '13–14 (The Rebellion of Absalom Begins)': [],
    '15–19 (Absalom\'s Coup and David\'s Flight)': [],
    '20 (The Rebellion of Sheba)': [],
    '21–24 (Appendices to David\'s Reign)': [],
    '1 Kings': ['1–2 (The Accession of Solomon)', '3–4 (Solomon\'s Wisdom and Prosperity)', '5–9:9 (The Building and Dedication of the Temple)', '9:10–11:43 (Solomon\'s Splendor and Decline)', '12–14 (The Division of the Kingdom)', '15–16 (The Early Kings of Judah and Israel)', '17–19 (The Ministry of Elijah)', '20–22:40 (The Wars and Death of Ahab)', '22:41–53 (The Reigns of Jehoshaphat and Ahaziah)'],
    '1–2 (The Accession of Solomon)': [],
    '3–4 (Solomon\'s Wisdom and Prosperity)': [],
    '5–9:9 (The Building and Dedication of the Temple)': [],
    '9:10–11:43 (Solomon\'s Splendor and Decline)': ['9:10–28 (Solomon\'s Further Building Projects)', '10:1–13 (The Visit of the Queen of Sheba)', '10:14–29 (Solomon\'s Great Wealth)', '11:1–13 (Solomon\'s Apostasy)', '11:14–40 (Solomon\'s Adversaries)', '11:41–43 (The Death of Solomon)'],
    '9:10–28 (Solomon\'s Further Building Projects)': [],
    '10:1–13 (The Visit of the Queen of Sheba)': [],
    '10:14–29 (Solomon\'s Great Wealth)': [],
    '11:1–13 (Solomon\'s Apostasy)': ['1Kgs 11:4', '1Kgs 11:5', '1Kgs 11:6', '1Kgs 11:7', '1Kgs 11:8'],
    '1Kgs 11:4': [],
    '1Kgs 11:5': [],
    '1Kgs 11:6': [],
    '1Kgs 11:7': [],
    '1Kgs 11:8': [],
    '11:14–40 (Solomon\'s Adversaries)': [],
    '11:41–43 (The Death of Solomon)': [],
    '12–14 (The Division of the Kingdom)': [],
    '15–16 (The Early Kings of Judah and Israel)': [],
    '17–19 (The Ministry of Elijah)': [],
    '20–22:40 (The Wars and Death of Ahab)': [],
    '22:41–53 (The Reigns of Jehoshaphat and Ahaziah)': [],
    '2 Kings': ['1–2:18 (The Transition from Elijah to Elisha)', '2:19–8:15 (The Miracles and Ministry of Elisha)', '8:16–12 (Political Turmoil in Judah and Israel)', '13–14 (The Death of Elisha and Expansion)', '15–17 (The Fall of the Northern Kingdom)', '18–20 (The Reign of Hezekiah)', '21–23:30 (Manasseh\'s Sin and Josiah\'s Reformation)', '23:31–25 (The Fall of the Southern Kingdom)'],
    '1–2:18 (The Transition from Elijah to Elisha)': ['1:1–8 (Ahaziah\'s Sickness and Message)', '1:9–16 (Fire from Heaven)', '1:17–18 (Death of Ahaziah)', '2:1–6 (The Journey to the Jordan)', '2:7–12 (Elijah Taken to Heaven)', '2:13–18 (Elisha Confirmed as Successor)'],
    '1:1–8 (Ahaziah\'s Sickness and Message)': [],
    '1:9–16 (Fire from Heaven)': ['2Kgs 1:10', '2Kgs 1:11', '2Kgs 1:12'],
    '2Kgs 1:10': [],
    '2Kgs 1:11': [],
    '2Kgs 1:12': [],
    '1:17–18 (Death of Ahaziah)': [],
    '2:1–6 (The Journey to the Jordan)': [],
    '2:7–12 (Elijah Taken to Heaven)': [],
    '2:13–18 (Elisha Confirmed as Successor)': [],
    '2:19–8:15 (The Miracles and Ministry of Elisha)': ['2:19–25 (Healing of the Water and the Curse of the Lads)', '3 (The War Against Moab)', '4 (Miracles for the Needy and Faithful)', '5 (The Healing of Naaman)', '6–7 (Aramean Wars and the Siege of Samaria)', '8 (The Shunammite\'s Land and Hazael\'s Usurpation)'],
    '2:19–25 (Healing of the Water and the Curse of the Lads)': ['2Kgs 2:23', '2Kgs 2:24'],
    '2Kgs 2:23': [],
    '2Kgs 2:24': [],
    '3 (The War Against Moab)': [],
    '4 (Miracles for the Needy and Faithful)': [],
    '5 (The Healing of Naaman)': [],
    '6–7 (Aramean Wars and the Siege of Samaria)': [],
    '8 (The Shunammite\'s Land and Hazael\'s Usurpation)': [],
    '8:16–12 (Political Turmoil in Judah and Israel)': [],
    '13–14 (The Death of Elisha and Expansion)': [],
    '15–17 (The Fall of the Northern Kingdom)': [],
    '18–20 (The Reign of Hezekiah)': [],
    '21–23:30 (Manasseh\'s Sin and Josiah\'s Reformation)': [],
    '23:31–25 (The Fall of the Southern Kingdom)': [],
    '1 Chronicles': ['1–9 (The Ancestries of Israel)', '10 (The Death of Saul)', '11–12 (David\'s Mighty Men and Rise to Power)', '13–16 (Bringing the Ark to Jerusalem)', '17 (The Covenant with David)', '18–20 (The Victories of David)', '21–22:1 (The Census and the Altar)', '22:2–29 (Preparations for the Temple and Solomon\'s Accession)'],
    '1–9 (The Ancestries of Israel)': [],
    '10 (The Death of Saul)': [],
    '11–12 (David\'s Mighty Men and Rise to Power)': [],
    '13–16 (Bringing the Ark to Jerusalem)': [],
    '17 (The Covenant with David)': [],
    '18–20 (The Victories of David)': [],
    '21–22:1 (The Census and the Altar)': [],
    '22:2–29 (Preparations for the Temple and Solomon\'s Accession)': [],
    '2 Chronicles': ['1 (Solomon\'s Wisdom and Wealth)', '2–7 (The Construction and Dedication of the Temple)', '8–9 (The Zenith of Solomon\'s Reign)', '10–12 (The Division and the Reign of Rehoboam)', '13–16 (The Reigns of Abijah and Asa)', '17–20 (The Reforms and Victories of Jehoshaphat)', '21–28 (The Cycle of Faithfulness and Apostasy)', '29–32 (The Great Reformation of Hezekiah)', '33–35 (From Manasseh to Josiah\'s Revival)', '36 (The Exile and the Decree of Cyrus)'],
    '1 (Solomon\'s Wisdom and Wealth)': [],
    '2–7 (The Construction and Dedication of the Temple)': [],
    '8–9 (The Zenith of Solomon\'s Reign)': [],
    '10–12 (The Division and the Reign of Rehoboam)': [],
    '13–16 (The Reigns of Abijah and Asa)': [],
    '17–20 (The Reforms and Victories of Jehoshaphat)': [],
    '21–28 (The Cycle of Faithfulness and Apostasy)': [],
    '29–32 (The Great Reformation of Hezekiah)': [],
    '33–35 (From Manasseh to Josiah\'s Revival)': [],
    '36 (The Exile and the Decree of Cyrus)': [],
    'Ezra': ['1–2 (The Decree of Cyrus and the Return of the Exiles)', '3–6 (The Rebuilding and Dedication of the Second Temple)', '7–8 (Ezra\'s Arrival in Jerusalem)', '9–10 (The Problem of Intermarriage and Spiritual Reform)'],
    '1–2 (The Decree of Cyrus and the Return of the Exiles)': [],
    '3–6 (The Rebuilding and Dedication of the Second Temple)': [],
    '7–8 (Ezra\'s Arrival in Jerusalem)': [],
    '9–10 (The Problem of Intermarriage and Spiritual Reform)': [],
    'Nehemiah': ['1 (Nehemiah\'s Prayer)', '2:1–8 (Nehemiah Sent to Jerusalem)', '2:9–20 (Nehemiah Inspects the Walls)', '3 (Builders of the Wall)', '4 (Opposition to the Rebuilding)', '5 (Nehemiah Helps the Poor)', '6 (Further Plots and Completion)', '7 (The List of Exiles)', '8 (Ezra Reads the Law)', '9 (A Public Confession)', '10 (The Agreement of the People)', '11–12:26 (Resettling and Priestly Lists)', '12:27–47 (Dedication of the Wall)', '13 (Nehemiah\'s Final Reforms)'],
    '1 (Nehemiah\'s Prayer)': [],
    '2:1–8 (Nehemiah Sent to Jerusalem)': [],
    '2:9–20 (Nehemiah Inspects the Walls)': [],
    '3 (Builders of the Wall)': [],
    '4 (Opposition to the Rebuilding)': [],
    '5 (Nehemiah Helps the Poor)': [],
    '6 (Further Plots and Completion)': [],
    '7 (The List of Exiles)': [],
    '8 (Ezra Reads the Law)': [],
    '9 (A Public Confession)': [],
    '10 (The Agreement of the People)': [],
    '11–12:26 (Resettling and Priestly Lists)': [],
    '12:27–47 (Dedication of the Wall)': [],
    '13 (Nehemiah\'s Final Reforms)': [],
    'Esther': ['1–2:18 (The Rise of Esther)', '2:19–3 (Haman\'s Plot Against the Jews)', '4–5 (Esther\'s Intervention)', '6–7 (The Fall of Haman)', '8–10 (The Deliverance and Festival of Purim)'],
    '1–2:18 (The Rise of Esther)': [],
    '2:19–3 (Haman\'s Plot Against the Jews)': [],
    '4–5 (Esther\'s Intervention)': [],
    '6–7 (The Fall of Haman)': [],
    '8–10 (The Deliverance and Festival of Purim)': [],
    'Poetic/Wisdom Books': ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'],

    // Job
    'Job': ['1–2 (The Prologue)', '3–31 (The Dialogue Cycles)', '32–37 (The Elihu Speeches)', '38–41 (The Divine Speeches)', '42 (The Epilogue)'],
    '1–2 (The Prologue)': ['1:1–5 (Job\'s Prosperity and Piety)', '1:6–12 (The First Heavenly Council)', '1:13–22 (The First Trial of Job)', '2:1–6 (The Second Heavenly Council)', '2:7–13 (The Second Trial and Silent Friends)'],
    '1:1–5 (Job\'s Prosperity and Piety)': [],
    '1:6–12 (The First Heavenly Council)': [],
    '1:13–22 (The First Trial of Job)': [],
    '2:1–6 (The Second Heavenly Council)': [],
    '2:7–13 (The Second Trial and Silent Friends)': [],
    '3–31 (The Dialogue Cycles)': ['3 (Job\'s Lament)', '4–14 (The First Cycle of Speeches)', '15–21 (The Second Cycle of Speeches)', '22–27 (The Third Cycle of Speeches)', '28 (The Interlude on Wisdom)', '29–31 (Job\'s Final Appeal)'],
    '3 (Job\'s Lament)': [],
    '4–14 (The First Cycle of Speeches)': [],
    '15–21 (The Second Cycle of Speeches)': [],
    '22–27 (The Third Cycle of Speeches)': ['22 (Eliphaz\'s Third Speech)', '23–24 (Job\'s Sixth Response)', '25 (Bildad\'s Third Speech)', '26 (Job\'s Reply to Bildad)', '27 (Job\'s Final Protest)'],
    '22 (Eliphaz\'s Third Speech)': [],
    '23–24 (Job\'s Sixth Response)': [],
    '25 (Bildad\'s Third Speech)': ['25:1–3 (The Dominion of God)', '25:4–6 (The Insignificance of Man)'],
    '25:1–3 (The Dominion of God)': [],
    '25:4–6 (The Insignificance of Man)': ['Job 25:6'],
    'Job 25:6': [],
    '26 (Job\'s Reply to Bildad)': [],
    '27 (Job\'s Final Protest)': [],
    '28 (The Interlude on Wisdom)': [],
    '29–31 (Job\'s Final Appeal)': [],
    '32–37 (The Elihu Speeches)': [],
    '38–41 (The Divine Speeches)': ['38 (The Lord Answers Job from the Whirlwind)', '39 (The Wonders of the Animal Kingdom)', '40:1–14 (Job\'s Humility and God\'s Renewed Challenge)', '40:15–24 (The Description of Behemoth)', '41 (The Description of Leviathan)'],
    '38 (The Lord Answers Job from the Whirlwind)': ['38:1–3 (The Divine Challenge)', '38:4–11 (Foundations of the Earth and Sea)', '38:12–15 (The Dawn and the Wicked)', '38:16–21 (The Deep and the Dark)', '38:22–30 (The Storehouses of Weather)', '38:31–33 (The Governance of the Stars)', '38:34–41 (The Provision for Wild Animals)'],
    '38:1–3 (The Divine Challenge)': [],
    '38:4–11 (Foundations of the Earth and Sea)': ['Job 38:4'],
    'Job 38:4': [],
    '38:12–15 (The Dawn and the Wicked)': [],
    '38:16–21 (The Deep and the Dark)': [],
    '38:22–30 (The Storehouses of Weather)': [],
    '38:31–33 (The Governance of the Stars)': [],
    '38:34–41 (The Provision for Wild Animals)': [],
    '39 (The Wonders of the Animal Kingdom)': [],
    '40:1–14 (Job\'s Humility and God\'s Renewed Challenge)': [],
    '40:15–24 (The Description of Behemoth)': [],
    '41 (The Description of Leviathan)': [],
    '42 (The Epilogue)': [],

    // Psalms
    'Psalms': ['1–41 (Book I: Genesis Comparison)', '42–72 (Book II: Exodus Comparison)', '73–89 (Book III: Leviticus Comparison)', '90–106 (Book IV: Numbers Comparison)', '107–150 (Book V: Deuteronomy Comparison)'],
    '1–41 (Book I: Genesis Comparison)': ['1–2 (Introduction to the Psalter)', '3–18 (David\'s Conflict and Deliverance)', '19–24 (God\'s Glory, Law, and Kingship)', '25–37 (Instruction, Trust, and Integrity)', '38–41 (Penitence, Sickness, and Betrayal)'],
    '1–2 (Introduction to the Psalter)': [],
    '3–18 (David\'s Conflict and Deliverance)': [],
    '19–24 (God\'s Glory, Law, and Kingship)': ['19 (The Heavens Declare)', '20 (The King\'s Victory)', '22 (The Suffering Servant)', '23 (The Good Shepherd)', '24 (The King of Glory)'],
    '19 (The Heavens Declare)': [],
    '20 (The King\'s Victory)': [],
    '22 (The Suffering Servant)': ['1–21 (The Cry of Anguish and Forsakenness)', '22–31 (The Vow of Praise and Victory)'],
    '1–21 (The Cry of Anguish and Forsakenness)': ['Psalm 22:6', 'Psalm 22:8', 'Psalm 22:14', 'Psalm 22:16', 'Psalm 22:18'],
    'Psalm 22:6': [],
    'Psalm 22:8': [],
    'Psalm 22:14': [],
    'Psalm 22:16': [],
    'Psalm 22:18': [],
    '22–31 (The Vow of Praise and Victory)': ['22–24 (Praise in the Congregation)', '25–29 (Universal Worship)', '30–31 (Future Generations)'],
    '22–24 (Praise in the Congregation)': [],
    '25–29 (Universal Worship)': [],
    '30–31 (Future Generations)': [],
    '23 (The Good Shepherd)': ['Psalm 23:4'],
    'Psalm 23:4': [],
    '24 (The King of Glory)': [],
    '25–37 (Instruction, Trust, and Integrity)': [],
    '38–41 (Penitence, Sickness, and Betrayal)': [],
    '42–72 (Book II: Exodus Comparison)': ['42–43 (Longing for God in Exile)', '44 (A National Lament)', '45 (A Royal Wedding Song)', '46–48 (Zion, the City of God)', '49 (The Futility of Wealth)', '50 (God\'s Judgment of Israel)', '51 (David\'s Prayer of Repentance)', '52–55 (Betrayal and Deceit)', '56–60 (Prayers for Protection from Enemies)', '61–63 (Thirsting for God)', '64–68 (God\'s Power in Nature and History)', '69–71 (Cries of the Suffering and Elderly)', '72 (A Prayer for the Messianic King)'],
    '42–43 (Longing for God in Exile)': [],
    '44 (A National Lament)': [],
    '45 (A Royal Wedding Song)': [],
    '46–48 (Zion, the City of God)': [],
    '49 (The Futility of Wealth)': [],
    '50 (God\'s Judgment of Israel)': [],
    '51 (David\'s Prayer of Repentance)': [],
    '52–55 (Betrayal and Deceit)': [],
    '56–60 (Prayers for Protection from Enemies)': [],
    '61–63 (Thirsting for God)': [],
    '64–68 (God\'s Power in Nature and History)': ['64 (Protection from Secret Plots)', '65 (God\'s Bounty in Creation)', '66 (A Liturgy of Thanksgiving)', '67 (A Prayer for Global Blessing)', '68 (The Triumphant Procession of God)'],
    '64 (Protection from Secret Plots)': [],
    '65 (God\'s Bounty in Creation)': [],
    '66 (A Liturgy of Thanksgiving)': ['66:1–4 (Universal Praise for God\'s Works)', '66:5–7 (The Great Deliverance at the Sea)', '66:8–12 (Refining Through Suffering)', '66:13–15 (Vows of Sacrifice)', '66:16–20 (A Personal Testimony of Answered Prayer)'],
    '66:1–4 (Universal Praise for God\'s Works)': [],
    '66:5–7 (The Great Deliverance at the Sea)': [],
    '66:8–12 (Refining Through Suffering)': [],
    '66:13–15 (Vows of Sacrifice)': [],
    '66:16–20 (A Personal Testimony of Answered Prayer)': [],
    '67 (A Prayer for Global Blessing)': [],
    '68 (The Triumphant Procession of God)': [],
    '69–71 (Cries of the Suffering and Elderly)': [],
    '72 (A Prayer for the Messianic King)': [],
    '73–89 (Book III: Leviticus Comparison)': ['73 (The Prosperity of the Wicked)', '74 (A Prayer for the Defiled Sanctuary)', '75–76 (God as the Righteous Judge)', '77 (Comfort in God\'s Past Power)', '78 (Lessons from Israel\'s History)', '79–80 (Lament for the Fallen Nation)', '81–83 (Exhortation and Judgment)', '84–85 (Longing for God\'s Dwelling)', '86–88 (Prayers in Deep Distress)', '89 (The Crumbled Covenant)'],
    '73 (The Prosperity of the Wicked)': [],
    '74 (A Prayer for the Defiled Sanctuary)': [],
    '75–76 (God as the Righteous Judge)': [],
    '77 (Comfort in God\'s Past Power)': [],
    '78 (Lessons from Israel\'s History)': [],
    '79–80 (Lament for the Fallen Nation)': [],
    '81–83 (Exhortation and Judgment)': [],
    '84–85 (Longing for God\'s Dwelling)': [],
    '86–88 (Prayers in Deep Distress)': ['86 (A Prayer in the Day of Trouble)', '87 (The City of God)', '88 (The Darkest Lament)'],
    '86 (A Prayer in the Day of Trouble)': ['86:1–7 (A Plea for Help)', '86:8–10 (The Incomparable God)', '86:11–13 (A Prayer for Guidance)', '86:14–15 (God\'s Compassionate Character)', '86:16–17 (A Request for a Sign)'],
    '86:1–7 (A Plea for Help)': [],
    '86:8–10 (The Incomparable God)': [],
    '86:11–13 (A Prayer for Guidance)': [],
    '86:14–15 (God\'s Compassionate Character)': [],
    '86:16–17 (A Request for a Sign)': [],
    '87 (The City of God)': [],
    '88 (The Darkest Lament)': [],
    '89 (The Crumbled Covenant)': [],
    '90–106 (Book IV: Numbers Comparison)': [],
    '107–150 (Book V: Deuteronomy Comparison)': [],

    // Proverbs
    'Proverbs': ['1–9 (The Prologue: Exhortations to Wisdom)', '10:1–22:16 (The Proverbs of Solomon)', '22:17–24:22 (The Thirty Sayings of the Wise)', '24:23–34 (Further Sayings of the Wise)', '25–29 (Hezekiah\'s Collection of Solomon\'s Proverbs)', '30 (The Sayings of Agur)', '31:1–9 (The Sayings of King Lemuel)', '31:10–31 (The Virtuous Woman)'],
    '1–9 (The Prologue: Exhortations to Wisdom)': ['1:1–7 (Purpose and Theme)', '1:8–19 (Warning Against Enticing Sinners)', '1:20–33 (The Call of Wisdom)', '2 (The Benefits of Wisdom)', '3:1–12 (Trusting the Lord)', '3:13–35 (The Value and Peace of Wisdom)', '4 (The Father\'s Instruction)', '5 (Warning Against Adultery)', '6:1–19 (Practical Warnings and the Seven Abominations)', '6:20–35 (The High Cost of Adultery)', '7 (The Crafty Seductress)', '8 (Wisdom\'s Autobiography)', '9 (The Two Banquets)'],
    '1:1–7 (Purpose and Theme)': [],
    '1:8–19 (Warning Against Enticing Sinners)': [],
    '1:20–33 (The Call of Wisdom)': [],
    '2 (The Benefits of Wisdom)': [],
    '3:1–12 (Trusting the Lord)': [],
    '3:13–35 (The Value and Peace of Wisdom)': [],
    '4 (The Father\'s Instruction)': [],
    '5 (Warning Against Adultery)': [],
    '6:1–19 (Practical Warnings and the Seven Abominations)': [],
    '6:20–35 (The High Cost of Adultery)': [],
    '7 (The Crafty Seductress)': [],
    '8 (Wisdom\'s Autobiography)': ['1–11 (Wisdom\'s Public Call)', '12–21 (The Character and Authority of Wisdom)', '22–31 (Wisdom\'s Role in Creation)', '32–36 (The Final Invitation and Warning)'],
    '1–11 (Wisdom\'s Public Call)': [],
    '12–21 (The Character and Authority of Wisdom)': ['Proverbs 8:12'],
    'Proverbs 8:12': [],
    '22–31 (Wisdom\'s Role in Creation)': ['Proverbs 8:22', 'Proverbs 8:23', 'Proverbs 8:30'],
    'Proverbs 8:22': [],
    'Proverbs 8:23': [],
    'Proverbs 8:30': [],
    '32–36 (The Final Invitation and Warning)': [],
    '9 (The Two Banquets)': [],
    '10:1–22:16 (The Proverbs of Solomon)': [],
    '22:17–24:22 (The Thirty Sayings of the Wise)': [],
    '24:23–34 (Further Sayings of the Wise)': [],
    '25–29 (Hezekiah\'s Collection of Solomon\'s Proverbs)': ['25 (Proverbs of Relationships and Self-Control)', '26:1–12 (The Anatomy of a Fool)', '26:13–28 (The Sluggard and the Deceiver)', '27 (The Nature of Friendship and Foresight)', '28 (Integrity versus Wickedness)', '29 (Leadership and Social Order)'],
    '25 (Proverbs of Relationships and Self-Control)': [],
    '26:1–12 (The Anatomy of a Fool)': [],
    '26:13–28 (The Sluggard and the Deceiver)': [],
    '27 (The Nature of Friendship and Foresight)': [],
    '28 (Integrity versus Wickedness)': [],
    '29 (Leadership and Social Order)': ['Proverbs 29:18'],
    'Proverbs 29:18': [],
    '30 (The Sayings of Agur)': ['30:1–9 (The Wisdom of Agur)', '30:11–14 (A Generation of Evil)', '30:15–16 (Four Things Never Satisfied)', '30:17 (Judgment on the Rebellious)', '30:18–20 (Four Things Too Amazing to Understand)', '30:21–23 (Four Things That Make the Earth Tremble)', '30:24–28 (Four Things Small but Wise)', '30:29–33 (Four Things Stately in Stride)'],
    '30:1–9 (The Wisdom of Agur)': ['Proverbs 30:4', 'Proverbs 30:5'],
    'Proverbs 30:4': [],
    'Proverbs 30:5': [],
    '30:11–14 (A Generation of Evil)': [],
    '30:15–16 (Four Things Never Satisfied)': [],
    '30:17 (Judgment on the Rebellious)': [],
    '30:18–20 (Four Things Too Amazing to Understand)': [],
    '30:21–23 (Four Things That Make the Earth Tremble)': [],
    '30:24–28 (Four Things Small but Wise)': [],
    '30:29–33 (Four Things Stately in Stride)': [],
    '31:1–9 (The Sayings of King Lemuel)': [],
    '31:10–31 (The Virtuous Woman)': [],

    // Ecclesiastes
    'Ecclesiastes': ['1:1–11 (The Futility of All Endeavors)', '1:12–2:26 (The Pursuit of Wisdom and Pleasure)', '3 (A Time for Everything)', '4:1–6:12 (The Observations of Social Injustice and Wealth)', '7:1–10:20 (Wisdom for Living in a Vain World)', '11:1–12:8 (Advice to the Young and the Certainty of Death)', '12:9–14 (The Conclusion of the Matter)'],
    '1:1–11 (The Futility of All Endeavors)': [],
    '1:12–2:26 (The Pursuit of Wisdom and Pleasure)': [],
    '3 (A Time for Everything)': ['A Time for Everything (3:1–8)', 'The God-Given Task (3:9–15)', 'The Fate of Humans and Beasts (3:16–22)'],
    'A Time for Everything (3:1–8)': ['Ecclesiastes 3:8'],
    'Ecclesiastes 3:8': [],
    'The God-Given Task (3:9–15)': [],
    'The Fate of Humans and Beasts (3:16–22)': [],
    '4:1–6:12 (The Observations of Social Injustice and Wealth)': [],
    '7:1–10:20 (Wisdom for Living in a Vain World)': [],
    '11:1–12:8 (Advice to the Young and the Certainty of Death)': [],
    '12:9–14 (The Conclusion of the Matter)': [],

    // Song of Solomon
    'Song of Solomon': ['1:1–2:7 (The Beginning of Love)', '2:8–3:5 (A Springtime Visit and a Dream)', '3:6–5:1 (The Royal Wedding)', '5:2–6:3 (A Conflict and Search)', '6:4–8:4 (Admiration and Longing)', '8:5–14 (The Power of Love)'],
    '1:1–2:7 (The Beginning of Love)': [],
    '2:8–3:5 (A Springtime Visit and a Dream)': [],
    '3:6–5:1 (The Royal Wedding)': [],
    '5:2–6:3 (A Conflict and Search)': [],
    '6:4–8:4 (Admiration and Longing)': [],
    '8:5–14 (The Power of Love)': [],
    'New Testament': ['Gospels', 'Acts', 'Epistles', 'Pauline Theology', 'Revelation'],
    'Gospels': [],
    'Epistles': [],
    'Revelation': [],
    'Acts': [],
    'Pauline Theology': [],
    'Biblical Theology': [],
    'Biblical Archaeology': [],
    'Biblical Languages': [],
    'Comparative Religion': [],
    'Religious Philosophy': [],
    'Mythology': ['Greek Mythology', 'Roman Mythology', 'Norse Mythology', 'Hindu Mythology', 'Egyptian Mythology'],
    'Greek Mythology': [],
    'Roman Mythology': [],
    'Norse Mythology': [],
    'Egyptian Mythology': [],
    
    // Arts
    'Arts': ['Literature', 'Visual Arts', 'Performing Arts', 'Music', 'Design'],
    
    // Literature
    'Literature': ['Fiction', 'Poetry', 'Drama', 'Literary Theory', 'World Literature', 'Classics', 'Essays', 'Narrative Forms'],
    'Fiction': ['Novels', 'Short Stories', 'Science Fiction', 'Fantasy', 'Historical Fiction', 'Literary Fiction'],
    'Novels': ['Victorian Novel', 'Modern Novel', 'Postmodern Novel', 'Contemporary Novel', 'Experimental Fiction', 'Realism'],
    'Victorian Novel': [],
    'Modern Novel': [],
    'Postmodern Novel': [],
    'Contemporary Novel': [],
    'Experimental Fiction': [],
    'Realism': [],
    'Short Stories': [],
    'Science Fiction': [],
    'Fantasy': [],
    'Historical Fiction': [],
    'Literary Fiction': [],
    'Poetry': ['Ancient Poetry', 'Medieval Poetry', 'Renaissance Poetry', 'Romantic Poetry', 'Modern Poetry', 'Contemporary Poetry', 'Epic Poetry', 'Lyric Poetry'],
    'Ancient Poetry': [],
    'Medieval Poetry': [],
    'Renaissance Poetry': [],
    'Romantic Poetry': [],
    'Modern Poetry': [],
    'Contemporary Poetry': [],
    'Epic Poetry': [],
    'Lyric Poetry': [],
    'Drama': ['Comedy', 'Tragedy', 'Tragicomedy', 'Classical Drama', 'Modern Drama', 'Contemporary Drama', 'Melodrama'],
    'Comedy': [],
    'Tragedy': [],
    'Tragicomedy': [],
    'Experimental Theatre': [],
    'Classical Drama': ['Greek Tragedy', 'Greek Comedy', 'Roman Tragedy', 'Roman Comedy', 'Satyr Play'],
    'Greek Tragedy': [],
    'Greek Comedy': [],
    'Roman Tragedy': [],
    'Roman Comedy': [],
    'Satyr Play': [],
    'Modern Drama': [],
    'Literary Theory': ['Structuralism', 'Deconstruction', 'Rhetoric', 'Semiotics', 'Narratology', 'Literary Criticism'],
    'Structuralism': [],
    'Deconstruction': [],
    'Rhetoric': [],
    'Semiotics': [],
    'Narratology': [],
    'Literary Criticism': [],
    'World Literature': [],
    'Classics': [],
    'Essays': [],
    'Narrative Forms': [],
    
    // Visual Arts
    'Visual Arts': ['Painting', 'Sculpture', 'Architecture', 'Photography', 'Film', 'Installation Art', 'Digital Art', 'Graphic Design', 'Printmaking'],
    'Painting': ['Renaissance Painting', 'Baroque Painting', 'Impressionism', 'Modernism', 'Abstract Art', 'Contemporary Painting', 'Color Theory', 'Technique'],
    'Renaissance Painting': [],
    'Baroque Painting': [],
    'Impressionism': [],
    'Modernism': [],
    'Abstract Art': [],
    'Contemporary Painting': [],
    'Color Theory': [],
    'Technique': [],
    'Sculpture': ['Classical Sculpture', 'Renaissance Sculpture', 'Modern Sculpture', 'Public Sculpture', 'Installation Sculpture', 'Contemporary Sculpture'],
    'Classical Sculpture': [],
    'Renaissance Sculpture': [],
    'Modern Sculpture': [],
    'Public Sculpture': [],
    'Installation Sculpture': [],
    'Contemporary Sculpture': [],
    'Architecture': ['Classical Architecture', 'Medieval Architecture', 'Renaissance Architecture', 'Modern Architecture', 'Postmodern Architecture', 'Contemporary Architecture', 'Architectural Theory', 'Urban Design'],
    'Classical Architecture': [],
    'Medieval Architecture': [],
    'Renaissance Architecture': [],
    'Modern Architecture': [],
    'Postmodern Architecture': [],
    'Contemporary Architecture': [],
    'Architectural Theory': [],
    'Urban Design': [],
    'Photography': ['Black and White Photography', 'Color Photography', 'Documentary Photography', 'Fine Art Photography', 'Photojournalism'],
    'Black and White Photography': [],
    'Color Photography': [],
    'Documentary Photography': [],
    'Fine Art Photography': [],
    'Photojournalism': [],
    'Film': ['Film History', 'Film Theory', 'Cinematography', 'Film Genres', 'Film Criticism', 'Animation', 'Documentary Film'],
    'Film History': [],
    'Film Theory': [],
    'Cinematography': [],
    'Film Genres': [],
    'Film Criticism': [],
    'Animation': [],
    'Documentary Film': [],
    'Installation Art': [],
    'Digital Art': ['Digital Painting', 'Digital Sculpture', 'Virtual Reality Art', 'Generative Art', 'Interactive Art'],
    'Digital Painting': [],
    'Digital Sculpture': [],
    'Virtual Reality Art': [],
    'Generative Art': [],
    'Interactive Art': [],
    'Graphic Design': ['Typography', 'Logo Design', 'Web Design', 'Branding', 'Layout Design'],
    'Typography': [],
    'Logo Design': [],
    'Web Design': [],
    'Branding': [],
    'Layout Design': [],
    'Printmaking': [],
    
    // Performing Arts
    'Performing Arts': ['Theatre', 'Dance', 'Performance Art', 'Musical Theatre'],
    'Theatre': ['Classical Theatre', 'Modern Theatre', 'Contemporary Theatre', 'Theatre Theory', 'Directing', 'Acting', 'Stage Design'],
    'Classical Theatre': [],
    'Modern Theatre': [],
    'Contemporary Theatre': [],
    'Theatre Theory': [],
    'Directing': [],
    'Acting': [],
    'Stage Design': [],
    'Dance': ['Classical Dance', 'Modern Dance', 'Contemporary Dance', 'Ballet', 'Jazz Dance', 'Hip Hop Dance'],
    'Classical Dance': [],
    'Modern Dance': [],
    'Contemporary Dance': [],
    'Ballet': [],
    'Jazz Dance': [],
    'Hip Hop Dance': [],
    'Performance Art': [],
    'Musical Theatre': [],
    
    // Music
    'Music': ['Classical Music', 'Jazz', 'Rock', 'Pop', 'World Music', 'Electronic Music', 'Music Theory', 'Composition'],
    'Classical Music': ['Baroque', 'Classical Period', 'Romantic', 'Modern Classical', 'Contemporary Classical', 'Opera', 'Orchestral Music', 'Chamber Music'],
    'Baroque': [],
    'Classical Period': [],
    'Romantic': [],
    'Modern Classical': [],
    'Contemporary Classical': [],
    'Orchestral Music': [],
    'Chamber Music': [],
    'Jazz': ['Early Jazz', 'Swing', 'Bebop', 'Cool Jazz', 'Free Jazz', 'Fusion', 'Modal Jazz', 'Jazz Standards'],
    'Early Jazz': [],
    'Swing': [],
    'Bebop': [],
    'Cool Jazz': [],
    'Free Jazz': [],
    'Fusion': [],
    'Modal Jazz': [],
    'Jazz Standards': [],
    'Rock': ['Classic Rock', 'Progressive Rock', 'Punk Rock', 'Alternative Rock', 'Heavy Metal'],
    'Classic Rock': [],
    'Progressive Rock': [],
    'Punk Rock': [],
    'Alternative Rock': [],
    'Heavy Metal': [],
    'Pop': [],
    'World Music': [],
    'Electronic Music': [],
    'Music Theory': [],
    'Composition': [],
    
    // Design
    'Design': ['Industrial Design', 'Fashion Design', 'Interaction Design', 'Game Design'],
    'Industrial Design': [],
    'Fashion Design': [],
    'Interaction Design': [],
    'Game Design': [],
    
    // Languages
    'Languages': ['Indo-European Languages', 'Sino-Tibetan Languages', 'Afro-Asiatic Languages', 'Austronesian Languages', 'Altaic Languages', 'Grammar', 'Linguistics', 'Translation', 'Phonetics', 'Semantics'],
    'Indo-European Languages': [],
    'Sino-Tibetan Languages': [],
    'Afro-Asiatic Languages': [],
    'Austronesian Languages': [],
    'Altaic Languages': [],
    'Grammar': [],
    'Linguistics': [],
    'Translation': [],
    'Phonetics': [],
    'Semantics': [],
    
    // Physics
    'Physics': ['Mechanics', 'Thermodynamics', 'Electromagnetism', 'Optics', 'Quantum Physics', 'Relativity'],
    'Mechanics': ['Classical Mechanics', 'Kinematics', 'Dynamics', 'Statics', 'Fluid Dynamics', 'Wave Motion'],
    'Classical Mechanics': [],
    'Kinematics': [],
    'Dynamics': [],
    'Statics': [],
    'Fluid Dynamics': [],
    'Wave Motion': [],
    'Thermodynamics': ['First Law', 'Second Law', 'Entropy', 'Heat Transfer', 'Phase Transitions', 'Cryogenics'],
    'First Law': [],
    'Second Law': [],
    'Entropy': [],
    'Heat Transfer': [],
    'Phase Transitions': [],
    'Cryogenics': [],
    'Electromagnetism': ['Electric Fields', 'Magnetic Fields', 'Maxwell Equations', 'Light', 'Radiation', 'Plasma'],
    'Electric Fields': [],
    'Magnetic Fields': [],
    'Maxwell Equations': [],
    'Light': [],
    'Radiation': [],
    'Plasma': [],
    'Optics': ['Geometric Optics', 'Wave Optics', 'Quantum Optics', 'Photonics', 'Lasers', 'Color'],
    'Geometric Optics': [],
    'Wave Optics': [],
    'Quantum Optics': [],
    'Photonics': [],
    'Lasers': [],
    'Color': [],
    'Quantum Physics': ['Wave-Particle Duality', 'Superposition', 'Entanglement', 'Uncertainty Principle', 'Quantum Computing', 'Quantum Field Theory'],
    'Wave-Particle Duality': [],
    'Superposition': [],
    'Entanglement': [],
    'Uncertainty Principle': [],
    'Quantum Computing': [],
    'Quantum Field Theory': [],
    'Relativity': ['Special Relativity', 'General Relativity', 'Spacetime', 'Gravity', 'Black Holes', 'Cosmological Constant'],
    'Special Relativity': [],
    'General Relativity': [],
    'Spacetime': [],
    'Gravity': [],
    'Cosmological Constant': [],
    
    // Chemistry
    'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Biochemistry', 'Analytical Chemistry', 'Materials Science'],
    'Organic Chemistry': ['Hydrocarbons', 'Functional Groups', 'Reactions', 'Synthesis', 'Natural Products', 'Polymers'],
    'Hydrocarbons': [],
    'Functional Groups': [],
    'Reactions': [],
    'Synthesis': [],
    'Natural Products': [],
    'Polymers': [],
    'Inorganic Chemistry': ['Main Group Chemistry', 'Transition Metals', 'Coordination Chemistry', 'Solid State Chemistry', 'Crystal Chemistry', 'Geochemistry'],
    'Main Group Chemistry': [],
    'Transition Metals': [],
    'Coordination Chemistry': [],
    'Solid State Chemistry': [],
    'Crystal Chemistry': [],
    'Geochemistry': [],
    'Physical Chemistry': ['Kinetics', 'Quantum Chemistry', 'Spectroscopy', 'Electrochemistry', 'Surface Chemistry'],
    'Kinetics': [],
    'Quantum Chemistry': [],
    'Spectroscopy': [],
    'Electrochemistry': [],
    'Surface Chemistry': [],
    'Biochemistry': ['Proteins', 'Carbohydrates', 'Lipids', 'Nucleic Acids', 'Enzymes', 'Metabolism'],
    'Proteins': [],
    'Carbohydrates': [],
    'Lipids': [],
    'Nucleic Acids': [],
    'Enzymes': [],
    'Metabolism': [],
    'Analytical Chemistry': [],
    'Materials Science': [],
    
    // Biology
    'Biology': ['Botany', 'Zoology', 'Microbiology', 'Genetics', 'Ecology', 'Molecular Biology'],
    'Botany': ['Plant Structure', 'Plant Physiology', 'Plant Reproduction', 'Plant Ecology', 'Agricultural Botany', 'Ethnobotany'],
    'Plant Structure': [],
    'Plant Physiology': [],
    'Plant Reproduction': [],
    'Plant Ecology': [],
    'Agricultural Botany': [],
    'Ethnobotany': [],
    'Zoology': ['Vertebrate Zoology', 'Invertebrate Zoology', 'Animal Behavior', 'Animal Physiology', 'Comparative Anatomy', 'Evolution'],
    'Vertebrate Zoology': [],
    'Invertebrate Zoology': [],
    'Animal Behavior': [],
    'Animal Physiology': [],
    'Comparative Anatomy': [],
    'Evolution': [],
    'Microbiology': ['Bacteriology', 'Virology', 'Mycology', 'Parasitology', 'Microbial Ecology', 'Microbial Genetics'],
    'Bacteriology': [],
    'Virology': [],
    'Mycology': [],
    'Parasitology': [],
    'Microbial Ecology': [],
    'Microbial Genetics': [],
    'Genetics': ['Classical Genetics', 'Molecular Genetics', 'Population Genetics', 'Quantitative Genetics', 'Evolutionary Genetics', 'Human Genetics'],
    'Classical Genetics': [],
    'Molecular Genetics': [],
    'Population Genetics': [],
    'Quantitative Genetics': [],
    'Evolutionary Genetics': [],
    'Human Genetics': [],
    'Ecology': ['Population Ecology', 'Community Ecology', 'Ecosystem Ecology', 'Biogeography', 'Conservation Biology', 'Restoration Ecology'],
    'Population Ecology': [],
    'Community Ecology': [],
    'Ecosystem Ecology': [],
    'Biogeography': [],
    'Conservation Biology': [],
    'Restoration Ecology': [],
    'Molecular Biology': ['DNA', 'RNA', 'Protein Synthesis', 'Gene Expression', 'Cell Biology', 'Developmental Biology'],
    'DNA': [],
    'RNA': [],
    'Protein Synthesis': [],
    'Gene Expression': [],
    'Cell Biology': [],
    'Developmental Biology': [],
    
    // Mathematics
    'Mathematics': ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Number Theory'],
    'Algebra': ['Linear Algebra', 'Abstract Algebra', 'Commutative Algebra', 'Homological Algebra', 'Representation Theory', 'Category Theory'],
    'Linear Algebra': [],
    'Abstract Algebra': [],
    'Commutative Algebra': [],
    'Homological Algebra': [],
    'Representation Theory': [],
    'Category Theory': [],
    'Geometry': ['Euclidean Geometry', 'Non-Euclidean Geometry', 'Differential Geometry', 'Algebraic Geometry', 'Topology', 'Discrete Geometry'],
    'Euclidean Geometry': [],
    'Non-Euclidean Geometry': [],
    'Differential Geometry': [],
    'Algebraic Geometry': [],
    'Topology': [],
    'Discrete Geometry': [],
    'Calculus': ['Differential Calculus', 'Integral Calculus', 'Multivariable Calculus', 'Complex Analysis', 'Functional Analysis', 'Harmonic Analysis'],
    'Differential Calculus': [],
    'Integral Calculus': [],
    'Multivariable Calculus': [],
    'Complex Analysis': [],
    'Functional Analysis': [],
    'Harmonic Analysis': [],
    'Statistics': ['Probability', 'Descriptive Statistics', 'Inferential Statistics', 'Regression', 'Bayesian Statistics', 'Experimental Design'],
    'Probability': [],
    'Descriptive Statistics': [],
    'Inferential Statistics': [],
    'Regression': [],
    'Bayesian Statistics': [],
    'Experimental Design': [],
    'Number Theory': ['Prime Numbers', 'Modular Arithmetic', 'Diophantine Equations', 'Cryptography', 'Analytic Number Theory', 'Algebraic Number Theory'],
    'Prime Numbers': [],
    'Modular Arithmetic': [],
    'Diophantine Equations': [],
    'Cryptography': [],
    'Analytic Number Theory': [],
    'Algebraic Number Theory': [],
    
    // Earth Science
    'Earth Science': ['Geology', 'Meteorology', 'Oceanography', 'Mineralogy', 'Seismology', 'Paleontology'],
    'Geology': ['Plate Tectonics', 'Rock Formation', 'Mineral Science', 'Structural Geology', 'Stratigraphy', 'Geomorphology'],
    'Plate Tectonics': [],
    'Rock Formation': [],
    'Mineral Science': [],
    'Structural Geology': [],
    'Stratigraphy': [],
    'Geomorphology': [],
    'Meteorology': ['Atmospheric Composition', 'Weather Patterns', 'Climate Systems', 'Storms', 'Air Pollution', 'Climate Change'],
    'Atmospheric Composition': [],
    'Weather Patterns': [],
    'Climate Systems': [],
    'Storms': [],
    'Air Pollution': [],
    'Climate Change': [],
    'Oceanography': [],
    'Mineralogy': [],
    'Seismology': [],
    'Paleontology': [],
    
    // Astronomy
    'Astronomy': ['Observational Astronomy', 'Planetary Science', 'Stellar Astronomy', 'Galactic Astronomy', 'Extragalactic Astronomy', 'Cosmology'],
    'Observational Astronomy': [],
    'Planetary Science': ['Inner Planets', 'Outer Planets', 'Moons', 'Asteroids', 'Comets', 'Exoplanets'],
    'Inner Planets': [],
    'Outer Planets': [],
    'Moons': [],
    'Asteroids': [],
    'Comets': [],
    'Exoplanets': [],
    'Stellar Astronomy': ['Star Formation', 'Star Life Cycle', 'Stellar Classification', 'Binary Stars', 'Pulsars', 'Neutron Stars'],
    'Star Formation': [],
    'Star Life Cycle': [],
    'Stellar Classification': [],
    'Binary Stars': [],
    'Pulsars': [],
    'Neutron Stars': [],
    'Galactic Astronomy': [],
    'Extragalactic Astronomy': [],
    'Cosmology': ['Origin of Universe', 'Structure of Universe', 'Big Bang', 'Black Holes', 'Dark Matter', 'Multiverse'],
    'Origin of Universe': [],
    'Structure of Universe': [],
    'Big Bang': [],
    'Black Holes': [],
    'Dark Matter': [],
    'Multiverse': [],
  }

  const nodeWidth = Math.round(NODE_WIDTH * nodeSizeScale)
  const nodeHeight = Math.round(NODE_HEIGHT * nodeSizeScale)
  const nodeSizePercent = Math.round(nodeSizeScale * 100)

  const adjustNodeSize = (delta) => {
    setNodeSizeScale((prev) => {
      const next = prev + delta
      const clamped = Math.max(NODE_SIZE_MIN, Math.min(NODE_SIZE_MAX, next))
      return Math.round(clamped * 100) / 100
    })
  }
  const adjustNodeSizeRef = useRef(adjustNodeSize)
  adjustNodeSizeRef.current = adjustNodeSize
  const [isZooming, setIsZooming] = useState(false)
  const isZoomingSetterRef = useRef(setIsZooming)
  const zoomTimeoutRef = useRef(null)

  useEffect(() => {
    window.localStorage.setItem('nodeSizeScale', String(nodeSizeScale))
  }, [nodeSizeScale])

  const layout = useMemo(
    () => buildLayout(nodes, TOPIC_SUBDIVISIONS, nodeWidth, nodeHeight),
    [nodes, recenterKey, TOPIC_SUBDIVISIONS, nodeWidth, nodeHeight],
  )
  layoutRef.current = layout
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const selectedNode = nodes.find((node) => node.id === selectedId)
  const isAuthenticated = Boolean(currentUser)

  // For verse nodes keyed as "Book chapter:verse", display only the verse number
  const getDisplayLabel = (label) => {
    // For verse nodes keyed as "Book chapter:verse", display only the verse number
    const m = label.match(/\s\d+:(\d+)$/)
    return m ? m[1] : label
  }

  // Calculate font size based on label length to ensure text fits in node
  const getNodeFontSize = (label) => {
    const length = label.length
    let baseSizeRem = 0.6
    if (length <= 15) baseSizeRem = 1.0
    else if (length <= 25) baseSizeRem = 0.9
    else if (length <= 35) baseSizeRem = 0.8
    else if (length <= 45) baseSizeRem = 0.7

    const scaledSize = baseSizeRem * nodeSizeScale
    return `${scaledSize.toFixed(2)}rem`
  }

  // Deselect if the selected node becomes hidden
  useEffect(() => {
    if (selectedId !== null) {
      const node = nodes.find((n) => n.id === selectedId)
      if (node && node.hidden) {
        setSelectedId(null)
        setPanelOpen(false)
      }
    }
  }, [selectedId, nodes])

  // Unfocus if the focused node becomes hidden
  useEffect(() => {
    if (!focusedElement) return;
    
    const node = nodes.find((n) => n.id === focusedElement.nodeId)
    if (node && node.hidden) {
      setFocusedElement(null)
    }
  }, [focusedElement, nodes])

  const generateSummary = (label) => {
    // Build a complete set of all node labels from the map structure
    const allLabels = new Set();
    // Add all keys and their children from TOPIC_SUBDIVISIONS
    Object.keys(TOPIC_SUBDIVISIONS).forEach((key) => {
      allLabels.add(key);
      const children = TOPIC_SUBDIVISIONS[key];
      if (Array.isArray(children)) {
        children.forEach((child) => allLabels.add(child));
      }
    });

    // Existing detailed summaries
    // Duplicates removed: only the last occurrence of each key is kept for predictable behavior
    const summaries = {
      'Greek Tragedy': 'Ancient Greek dramatic genre focusing on human suffering, fate, and moral lessons.',
      'Greek Comedy': 'Ancient Greek dramatic genre characterized by humor, satire, and social commentary.',
      'Roman Tragedy': 'Roman adaptation of Greek tragedy, emphasizing rhetoric and political themes.',
      'Roman Comedy': 'Roman adaptation of Greek comedy, featuring stock characters and everyday life.',
      'Satyr Play': 'Ancient Greek theatrical form blending tragedy and comedy, often with mythological themes.',
      // Root level
      'Everything': 'A conceptual map connecting all fields of human knowledge and inquiry.',
      'Humanities': 'Disciplines that study human culture, history, language, and values.',
      'Sciences': 'Fields that investigate the natural world through observation and experimentation.',
      'Philosophy': 'The pursuit of wisdom through critical analysis of existence, knowledge, and ethics.',
      'Ethics/Moral Philosophy': 'The branch of philosophy concerned with moral principles and how we ought to act.',
      'Aristotle\'s Virtue Ethics': 'Emphasizes the cultivation of excellent character traits (virtues) through practical wisdom and habitual action as the means to achieve eudaimonia — flourishing or living well.',
      'Character Development': 'The process of cultivating moral excellence and virtuous habits over time.',
      'Aristotelian Ethics': 'The ethical framework developed by Aristotle emphasizing virtue, practical wisdom, and human flourishing.',
      'Flourishing': 'The state of living well and achieving one\'s full potential as a human being.',
      'Practical Wisdom': 'The ability to discern the right course of action in particular circumstances.',
      'Moral Exemplars': 'Individuals who embody exceptional moral character and serve as models for ethical conduct.',
      'Virtues': 'Positive character traits or dispositions to act morally and excellently.',
      'Courage': 'The virtue of facing fear, danger, or adversity with strength and determination.',
      'Wisdom': 'The virtue of sound judgment, insight, and understanding in practical and theoretical matters.',
      'Temperance': 'The virtue of self-control, moderation, and restraint in desires and actions.',
      'Justice': 'The fair and equitable distribution of resources, rights, and responsibilities within a society, the fair administration of laws, and the rectification of wrongs.',
      'Injustice': 'The violation of norms of distributive justice, procedural justice, or human rights — often manifesting systemically to deny individuals or groups their rightful liberties, resources, or recognition.',
      'Compassion': 'The virtue of empathetic concern for the suffering of others coupled with a desire to help.',
      'Honesty': 'The virtue of truthfulness, sincerity, and integrity in one\'s words and actions.',
      'Kant\'s Deontology': 'Centers on the idea that morality is based on duty, derived from reason and expressed through the categorical imperative — act only according to principles that could be universal laws, treating humanity always as an end and never merely as a means.',
      'Duty': 'A moral or legal obligation to perform certain actions based on ethical principles.',
      'Kant': 'Immanuel Kant, the philosopher who developed deontological ethics and the categorical imperative.',
      'Rules': 'Principles or directives that prescribe or prohibit specific actions in ethical systems.',
      'Rights': 'Entitlements or claims that individuals possess based on moral or legal principles.',
      'Categorical Imperative': 'Kant\'s central ethical principle that one should act only according to maxims that could become universal laws.',
      'Moral Law': 'Universal principles of right conduct that bind all rational agents.',
      'Consequentialism': 'Asserts that the morality of an action is determined solely by its consequences, with actions that produce the best overall outcomes being considered morally right.',
      'Utilitarianism': 'Holds that the morally right action is the one that produces the greatest happiness or well-being for the greatest number of people.',
      'Basic Moral Dilemmas': 'Thought experiments that test and reveal moral intuitions by posing scenarios where standard ethical principles conflict.',
      'The Trolley Problem': 'A dilemma in which a runaway trolley will kill five people unless a lever is pulled to divert it onto a side track, where it will kill one — raising questions about the ethics of actively causing harm to prevent greater harm.',
      'The Footbridge Dilemma': 'A variant of the trolley problem in which the only way to stop the trolley is to push a large person off a footbridge onto the tracks — testing whether direct, personal physical harm differs morally from indirect harm.',
      'Variance in Intuition': 'Intuitions regarding basic moral dilemmas show a remarkable degree of stability across diverse demographic and cultural groups, particularly concerning the core aversion to direct, intentional harm.',
      'Act Utilitarianism': 'The view that the rightness of an action is determined by whether it maximizes utility in that particular situation.',
      'Rule Utilitarianism': 'The view that the rightness of an action is determined by whether it conforms to rules that maximize overall utility.',
      'Preference Utilitarianism': 'The view that the best action is the one that satisfies the most preferences or desires.',
      'Hedonic Calculus': 'A method for calculating the amount of pleasure or pain produced by an action.',
      'Singer': 'Peter Singer, a contemporary utilitarian philosopher known for work on animal rights and effective altruism.',
      'Bentham': 'Jeremy Bentham, founder of modern utilitarianism and creator of the hedonic calculus.',
      'Happiness': 'A state of well-being, contentment, or pleasure central to utilitarian ethics.',
      'Well-being': 'The state of living a good life characterized by health, happiness, and fulfillment.',
      'Preference Satisfaction': 'The fulfillment of an individual\'s desires or preferences as a measure of utility.',
      'Cost-Benefit Analysis': 'A systematic approach to estimating the strengths and weaknesses of alternatives to determine the best option.',
      'Greatest Good': 'The utilitarian principle of maximizing overall benefit or happiness for the largest number of people.',
      'Applied Ethics': 'The practical application of ethical theories to real-world issues and dilemmas.',
      'Philosophy of Law': 'Analyzes law\'s relation to morality, justice, and authority, and how legal systems function within society.',
      'Justice before Mercy': 'The view that strict adherence to moral or legal rules and deserved consequences takes priority over compassion or leniency when accountability is at stake.',
      'Bioethics': 'The study of ethical issues in medicine, biology, and the life sciences.',
      'Environmental Ethics': 'The examination of moral relationships between humans and the environment.',
      'Metaphysics': 'The branch of philosophy that explores the fundamental nature of reality and existence.',
      'Arguments for God\'s Existence': 'Philosophical arguments attempting to demonstrate the existence of God, including the ontological, cosmological, and teleological arguments.',
      'Aquinas\'s 5 Ways': 'Thomas Aquinas\'s five rational demonstrations for the existence of God, drawn from observation of the natural world.',
      'Cosmological Arguments': 'Arguments that reason from the existence or nature of the universe to the existence of God as its ultimate cause or ground.',
      'The Unmoved Mover Argument': 'Aquinas\'s first way: since everything in motion is moved by something else, there must be a first unmoved mover — God.',
      'The First Cause Argument': 'Aquinas\'s second way: since every effect has a cause, and an infinite regress is impossible, there must be a first uncaused cause — God.',
      'The Contingency Argument': 'Aquinas\'s third way: since contingent things depend on other things to exist, there must be a necessary being whose existence is self-grounded — God.',
      'We observe contingent things': 'Contingent things are those that exist but could have not existed — they depend on something else for their being.',
      'If everything were contingent, nothing would exist': 'If all things were contingent, there would have been a time when nothing existed, and from nothing, nothing can come.',
      'The Chain Analogy': 'A chain link requires either a hook or a prior link to hold it up. Without a hook, an infinite chain of links still falls — something must anchor it.',
      'The Domino Analogy': 'Dominoes fall from a flick or a prior domino. Without a first flick, none fall — an infinite causal chain still requires an initiator.',
      'Rowe\'s Hume-Edwards Principle': 'If the existence of every member of a set is explained, the existence of the set is thereby explained. An infinite chain of contingent things may be self-explaining, making a necessary being unnecessary.',
      'The Argument from Gradation of Being': 'Aquinas\'s fourth way: since things possess varying degrees of goodness, truth, and perfection, there must be a maximum — a most perfect being — that is God.',
      'The Argument from Governance/Design': 'Aquinas\'s fifth way: since unintelligent natural things act toward ends, there must be an intelligent being directing them — God.',
      'Descartes\' Arguments for the Existence of God': 'Three distinct arguments Descartes offers in the Meditations to prove God\'s existence, grounding his broader epistemological project.',
      'The Trademark/Causal Argument': 'Descartes argues that his idea of an infinitely perfect God could only have been caused by an actually infinitely perfect being — God must exist.',
      'A cause must be at least as perfect as its effect': 'Descartes\'s causal adequacy principle: nothing can give what it does not have, so the cause of an idea must contain at least as much reality as the idea represents.',
      'The Ontological Argument': 'Descartes argues that existence is a perfection, and since God is defined as supremely perfect, God must exist — just as a triangle must have three sides.',
      'The Argument from the Preservation of Existence': 'Descartes argues that since he cannot sustain his own existence from moment to moment, something else must continuously cause him to persist — and that being is God.',
      'Metaphysics of Modality': 'The study of the fundamental nature of possibility, necessity, contingency, and impossibility, and how these concepts relate to reality.',
      'Contingent vs. Necessary': 'The central modal distinction between things that exist or are true only under certain conditions versus things that must exist or be true in all possible circumstances.',
      'Contingent': 'Beings or truths that could exist or be true, or could fail to — their existence or truth depends on something else. Example: a baseball game being delayed is contingent on whether it rains.',
      'Intuitive Appeal of Contingency': 'We experience choice, regret, and open futures so pervasively that contingency is difficult to dismiss as an illusion; the conceivability of alternatives is itself evidence for their possibility.',
      'Necessary': 'Beings or truths that must exist or be true and cannot fail to — their existence or truth is inherent. Example: oxygen is necessary for human life.',
      'Global Necessitarianism': 'The view that there is only one way the world could possibly be — everything that exists and happens is necessarily so, leaving no room for genuine contingency.',
      'Strong Determinism': 'The actual world is the only possible world; every detail of reality is necessary, and contingency is an illusion.',
      'Spinoza\'s Necessitarianism': 'Everything necessarily follows from the nature of God (or Nature), so nothing is truly contingent — all things are necessary expressions of the one infinite substance.',
      'Ontology': 'A subfield of metaphysics concerned with the categories and nature of being.',
      'Aristotle\'s Substance Ontology': 'Aristotle\'s metaphysical view that reality consists of substances — particular things that exist independently and underlie all other categories of being.',
      'The 10 Categories of Being': 'Aristotle\'s classification of everything that can be said to exist into ten fundamental kinds: one substance category and nine accidental categories.',
      'Substance': 'The primary category of being — the independently existing, self-subsistent individual thing that underlies all other categories.',
      'Fundamental/Primacy': 'Substance underlies and is the subject of all nine non-substance categories; the others depend on it for their existence.',
      'Independent and Self-Sufficient': 'Substance does not depend on anything else for its existence — it exists in its own right.',
      'Self-Subsistent': 'Substance is the subject of predication, not predicated of something else; it does not exist as an attribute in another thing.',
      'Individual': 'Substance is a single, undivided entity — not a collection of separate, independent parts.',
      'Types of Substance': 'Aristotle distinguishes two kinds of substance: primary (the individual thing) and secondary (its species or genus).',
      'Primary Substance': 'The individual instantiation of a thing — a composite of matter and form, with the form actualizing the matter (e.g., this particular person, body and soul).',
      'Secondary Substance': 'The type or kind a primary substance belongs to — its species or genus. It expresses essence and essential properties, as opposed to the nine accidental categories.',
      'Persistent Through Accidental Change': 'Substance persists through changes in its accidental (non-essential) properties, but ceases to be what it is if its substantial form changes.',
      'Change': 'Substance is the cause of the existence and changes of all other things; Aristotle analyzes change through hylomorphism and his four causes.',
      'Four Causes': 'Aristotle\'s four explanatory principles for why anything exists, moves, or comes to be: material, formal, efficient, and final.',
      'Material Cause': 'The matter from which something is generated — what a thing is made of (corresponds to primary substance).',
      'Formal Cause': 'The essence or form that determines what a thing is — the pattern or structure that makes matter into a particular kind of thing (corresponds to secondary substance).',
      'Efficient Cause': 'The agent or source that brings something into being — the direct cause of change or generation.',
      'Final Cause': 'The telos — the purpose or end for which something exists or toward which it acts.',
      'Non-Substance Categories': 'The nine accidental categories — properties that exist only in a substance as their subject and are not necessary to its essence.',
      'Quantity': 'How much or how many — the measurable extent of a substance (e.g., six feet tall).',
      'Quality': 'What kind a thing is — characteristics such as color, texture, or virtue.',
      'Relation': 'How a substance stands in comparison or reference to another (e.g., larger than, father of).',
      'Place': 'Where a substance is located.',
      'Position': 'The arrangement or posture of a substance\'s parts (e.g., sitting, standing).',
      'Having/State': 'What a substance has on or about it (e.g., wearing armor, being shod).',
      'Action': 'What a substance does — the activity it performs on another (e.g., cutting).',
      'Passion': 'What is done to a substance — the effect it undergoes from another\'s action (e.g., being cut).',
      'Existence vs. Essence': 'The philosophical debate over the relationship between that something is (existence) and what something is (essence).',
      'Existence': 'That something is — the sheer fact of a thing\'s being, prior to any consideration of what it is.',
      'Essence': 'What something is — the defining nature or set of properties that make a thing the kind of thing it is.',
      'Aquinas\'s Existential Distinction': 'Aquinas holds that in created beings essence and existence are really distinct — existence is received from God — while in God alone they are identical.',
      'In Created Beings': 'Essence precedes existence: God conceives the essence and then grants existence to the creature. Essence and existence are really distinct in all created things.',
      'In God': 'God\'s essence just is to exist — essence and existence are perfectly identical in God, which is why God alone exists necessarily.',
      'Sartre\'s Existence Precedes Essence': 'Humans first exist, then create their own essence through choices. Condemned to radical freedom, there is no pre-given human nature — we define ourselves entirely through what we do.',
      'Platonic Dualism': 'Plato\'s answer to the Problem of the One and the Many: reality is divided into two realms — a superior, eternal, unchanging realm of perfect Forms, and an inferior, transient, imperfect realm of physical objects that are mere copies of those Forms. Particulars are unified under a Form through participation — a thing is beautiful insofar as it participates in the Form of Beauty.',
      'Realm of Forms': 'The higher realm of perfect, eternal, and unchanging essences — the true objects of knowledge.',
      'The Form of the Good (Agathon)': 'The highest Form in Plato\'s hierarchy — the source of all being, truth, and goodness, analogous to the sun illuminating all other Forms.',
      'Higher-Level Forms': 'The ethical and aesthetic Forms — perfect, eternal ideals of fundamental values.',
      'The Form of Justice': 'The perfect, eternal essence of justice, of which all just acts and institutions are imperfect copies.',
      'The Form of Beauty': 'The perfect, eternal essence of beauty, of which all beautiful things partake imperfectly.',
      'The Form of Courage': 'The perfect, eternal essence of courage.',
      'The Form of Piety': 'The perfect, eternal essence of piety — the subject of Plato\'s Euthyphro.',
      'The Realm of Sensible Particulars': 'The imperfect, changing, material objects of ordinary experience — copies or imitations of the Forms, grasped through perception rather than reason.',
      'The Problem of the One and the Many': 'How is a single, unifying concept present in multiple, diverse instances?',
      'Relationality': 'The view that entities are fundamentally constituted by their relations to other things rather than by intrinsic properties alone.',
      'Types of Relations': 'The major categories of relations that can hold between entities.',
      'Causal Relations': 'Relations describing the fundamental connection where one event or entity directly brings about or influences the existence or properties of another.',
      'Spatial Relations': 'Relations specifying the positions, distances, and orientations of objects relative to one another in physical space.',
      'Temporal Relations': 'Relations defining the order, sequence, duration, or simultaneity of events in time.',
      'Relationalism': 'The view that entities are inherently constituted, defined, or exist primarily through their relationships to other entities — relationality as fundamental.',
      'Vervaeke\'s Pure Relationality': 'Relations and relata co-emerge out of something more primordial — neither the things nor their relations are metaphysically prior to each other.',
      'Nature of Relations': 'The question of whether relations depend on the intrinsic properties of the things they connect, or hold independently of them.',
      'Internal Relations': 'Relations that depend on the intrinsic properties of the relata — change those properties and the relation changes with them.',
      'External Relations': 'Relations that hold between entities independently of their intrinsic properties.',
      'Relational Identity': 'The view that an entity\'s identity is constituted or defined by its relationships to other things.',
      'Relata': 'The entities being connected by a relation.',
      'Relational Properties': 'Properties that an entity possesses only in virtue of its relationships to other things.',
      'Whitehead\'s Process Ontology': 'Alfred North Whitehead\'s metaphysical system holding that processes, changes, and events are the fundamental constituents of reality, rather than static, enduring substances.',
      'Why is there something rather than nothing?': 'The fundamental metaphysical question asking why the universe exists at all, rather than there being complete absence.',
      'Pearce\'s Zero Ontology': 'Conscious experience, with its inherent "somethingness" of valence, is what creates the "something" we perceive — existence is entailed in conscious experience itself.',
      'Criticism of Pearce\'s Zero Ontology': 'Pearce equivocates nothingness with neutral consciousness — a state lacking any positive or negative affect — which smuggles in a form of existence rather than true nothingness.',
      'Cosmology': 'The scientific and philosophical study of the origin, structure, and evolution of the universe.',
      'Origin of Universe': 'The study of how the universe came into being and its earliest moments.',
      'Structure of Universe': 'The organization and composition of matter, energy, and space on the largest scales.',
      'Big Bang': 'The prevailing cosmological model describing the universe\'s expansion from an extremely hot, dense initial state.',
      'Black Holes': 'Regions of spacetime where gravity is so strong that nothing, not even light, can escape.',
      'Dark Matter': 'Invisible matter that does not interact with electromagnetic radiation but exerts gravitational effects.',
      'Multiverse': 'The hypothetical collection of multiple or infinite universes comprising all of existence.',
      'Free Will': 'The capacity of agents to make choices that are genuinely up to them, uncoerced by external forces or predetermined by prior events.',
      'Agency': 'The capacity of individuals to act independently and make their own choices.',
      'Compatibilism': 'The view that free will and determinism are both true and compatible with one another.',
      'Determinism': 'Every event, including human cognition and action, is causally determined by an unbroken chain of prior occurrences — given the initial conditions and the laws of nature, only one future is possible.',
      'Causal/Physical Determinism': 'All events, including human actions, are entirely determined by prior causes and the fixed laws of nature, such that given the past and these laws, only one future is possible.',
      'Logical Determinism/Fatalism': 'The future is already fixed and unavoidable because propositions about future events are already definitively true or false now.',
      'The Principle of Bivalence': 'Every proposition is either true or false — there is no middle ground.',
      'The Conditional': 'If a proposition is true, it is necessarily true at all times — its truth cannot change.',
      'The Conclusion': 'Therefore, if a proposition about a future event is true now, that event is necessarily going to happen.',
      'Aristotle\'s Sea Battle Argument': 'Is the statement "There will be a sea battle tomorrow" true or false today? If true, the battle must occur — implying no contingency and no free will.',
      'Theological Determinism': 'All events are ultimately determined by a divine being, either through divine foreknowledge (God knows the future, so it must happen) or divine preordination (God wills everything that happens).',
      'Indeterminism': 'The view that not all events are necessarily determined by prior causes.',
      'Libertarianism': 'The metaphysical view that free will exists and is incompatible with determinism.',
      'Responsibility': 'The state of being morally accountable for one\'s actions and their consequences.',
      'Free Will vs. Determinism': 'The debate over whether human choices are genuinely free or entirely determined by prior causes, and whether these positions are compatible.',
      'Causality': 'The relationship between an event (the cause) and a second event (the effect), where the second event is understood as a consequence of the first.',
      'Substance Theory': 'The metaphysical view that objects are composed of an underlying substance that bears their properties.',
      'Time': 'The dimension along which events occur in sequence, from past through present to future.',
      'Being': 'The most fundamental concept in ontology, referring to existence itself.',
      'Categories': 'The most general classes or types of entities that exist.',
      'Properties': 'Characteristics or attributes that entities possess.',
      'Relations': 'Connections or associations between two or more entities.',
      'Universals': 'Abstract entities or qualities that can be instantiated by multiple particular things.',
      'Consciousness': 'The subjective experience of awareness, perception, sensation, and thought.',
      'Intentionality': 'The property of mental states being directed toward or about objects, events, or states of affairs.',
      'Qualia': 'The intrinsic, subjective qualities of conscious experience — what it is like to see red or feel pain.',
      'Personal Identity': 'The philosophical question of what makes an individual the same person over time.',
      'Artificial Intelligence': 'The simulation of human intelligence in machines, raising questions about mind, consciousness, and cognition.',
      'Philosophy of Cognition': 'Explores the nature of mental processes involved in acquiring knowledge and understanding — perception, memory, reasoning, and problem-solving — often in dialogue with empirical cognitive science.',
      'Computationalism': 'The theory that the mind, or at least its cognitive processes, can be understood as a computational system that processes information, analogous to how a computer operates.',
      'Limits of Computationalism': 'Challenges to the view that all cognitive processes are computational in nature.',
      'Vervaeke\'s Relevance Realization': 'John Vervaeke\'s theory that cognitive agents dynamically and recursively zero in on what is significant and pertinent amidst overwhelming information — a process that enables adaptive behavior by avoiding combinatorial explosion and which Vervaeke argues is non-computational.',
      'Conceptualism': 'Universals exist only as concepts within the mind, derived from experience — neither as independent entities in reality (against Platonism) nor as mere names (against Nominalism).',
      'Ockham\'s Conceptualism': 'Ockham\'s challenge to Platonic Forms and Aristotelian real universals: only individual things exist in external reality; universals are mental concepts — natural signs formed by the mind to categorize similar individuals, real as mental acts but not as things in the world.',
      'The Mind-Body Problem': 'The challenge of explaining how mental phenomena — thoughts, feelings, consciousness — are related to the physical body and brain.',
      'Dualism': 'The view that mind and body are two fundamentally distinct kinds of substance or property.',
      'Cartesian Substance Dualism': 'Descartes\' thesis that mind (res cogitans) and body (res extensa) are two completely distinct substances — one thinking and unextended, the other extended and unthinking.',
      'Mind': 'Descartes\' res cogitans: an indivisible, unextended thinking substance whose essence is thought.',
      'Body': 'Descartes\' res extensa: a divisible, extended material substance whose essence is to occupy space.',
      'How do the two Substances causally interact?': 'Descartes proposed that the immaterial mind influences the body via the pineal gland — causing it to move and redirect "animal spirits" (fine material fluids) through the brain to initiate bodily movement, while sensory information travels back from body to mind by the same route.',
      'Argument from Doubt': 'Since I can doubt the existence of my body but cannot doubt the existence of my thinking self, my mind must be distinct from my body.',
      'Argument from Divisibility': 'All extended things (like the body) are divisible, but the mind is indivisible; therefore, the mind cannot be identical to the body.',
      'Argument from Clear and Distinct Perception': 'If I can clearly and distinctly conceive of mind existing without body, and body without mind, then they are truly distinct substances.',
      'Emotivism': 'The view that moral statements are expressions of emotional attitudes rather than factual claims that can be true or false.',
      'Epistemology': 'The study of knowledge, its nature, sources, and limits.',
      'Sources of Knowledge': 'The study of where knowledge comes from, including sensory experience, reason, testimony, memory, and perception.',
      'Empiricism': 'The epistemological view that knowledge is primarily derived from sensory experience.',
      'Rationalism': 'The epistemological view that knowledge is primarily derived from reason and innate ideas or intuition, independent of sensory experience.',
      'Testimony': 'Knowledge gained from the reports, assertions, or communications of others.',
      'Memory': 'Knowledge retained and recalled from past experiences.',
      'Perception': 'Knowledge gained through the senses and their interaction with the external world.',
      'The Nature of Knowledge': 'Philosophical inquiry into what knowledge is, what conditions are necessary for it, and how it differs from mere belief.',
      'Belief': 'A mental state of accepting something as true or real.',
      'Skepticism': 'The philosophical position that questions the possibility of certain or complete knowledge.',
      'Truth': 'The property of statements, beliefs, or propositions corresponding to reality or facts.',
      'Correspondence Theory': 'The view that truth consists in correspondence or agreement with facts or reality.',
      'Coherence Theory': 'The view that truth consists in coherence with a system of beliefs or propositions.',
      'Pragmatism': 'The view that truth is defined by practical consequences and usefulness.',
      'Deflationism': 'The view that truth is a minimal, logical concept without deep metaphysical content.',
      'Pluralism': 'The view that truth can take multiple forms depending on the domain of discourse.',
      'Relativism': 'The view that truth, knowledge, or morality varies depending on culture, context, or perspective.',
      'Propositional Knowledge': 'Knowledge of facts or propositions, expressed as "knowing that."',
      'Acquaintance Knowledge': 'Direct experiential awareness of objects, people, or places, expressed as "knowing of."',
      'Skill Knowledge': 'Practical expertise or ability to do something, expressed as "knowing how."',
      'Infallibilism': 'The view that knowledge requires absolute certainty and cannot be mistaken.',
      'Fallibilism': 'The view that knowledge is possible even though our beliefs may be subject to error.',
      'The Justified True Belief Account of Knowledge': 'The classical analysis holding that to know a proposition, it must be true, one must believe it, and that belief must be justified.',
      'Justification': 'The reasons, evidence, or processes that make a belief epistemically warranted.',
      'Internalism': 'The view that the factors justifying a belief are internal to the believer\'s mind — accessible through introspection or conscious reflection. Example: Sarah\'s belief that there\'s a dog in the park is justified because she consciously sees and recognizes the animal, relying on her accessible visual experience.',
      'Externalism': 'The view that justification can depend on factors external to the believer\'s mind, such as the reliability of a cognitive process. Example: A reliable thermometer\'s reading justifies the belief that the temperature is 72°, even if the user doesn\'t know how the thermometer works.',
      'Foundationalism': 'The view that knowledge is structured hierarchically, with some beliefs serving as foundational and self-evident, justifying all others.',
      'Coherentism': 'The view that beliefs are justified by their coherence and mutual support with other beliefs in a web of interconnected beliefs.',
      'The Gettier Problem': 'Edmund Gettier\'s 1963 challenge showing that justified true belief is insufficient for knowledge, because a belief can be justified and true yet fail to constitute knowledge if its truth is due to luck.',
      'Gettier Intuition': 'The widely shared philosophical judgment that a belief, even if justified and true, does not count as knowledge if its truth is due to luck or accidental circumstances rather than a genuine connection to the justification.',
      'Examples': 'Classic thought experiments illustrating how justified true belief can fail to constitute knowledge.',
      'Smith and Jones': 'Smith believes the man who will get the job has ten coins in his pocket, based on evidence about Jones. Smith gets the job and happens to have ten coins himself — making the belief true but only by luck.',
      'Jones and the Ford': 'Smith justifiably believes Jones owns a Ford and infers "Jones owns a Ford or Brown is in Barcelona." Jones doesn\'t own a Ford, but Brown happens to be in Barcelona — the belief is true, but grounded in a false premise.',
      'The Stopped Clock': 'A person looks at a stopped clock that happens to show the correct time, forming a true and seemingly justified belief — but only by coincidence, not reliable perception.',
      'The Sheep in the Field': 'A person sees what appears to be a sheep but is actually a disguised dog; a real sheep is hidden behind a hill. The belief "There is a sheep in the field" is true and apparently justified, but the justification is disconnected from what makes it true.',
      'Goldman\'s Fake Barns': 'Henry drives through a county full of barn façades and happens to look at the one real barn, forming a true and justified belief. Because his method would yield false beliefs elsewhere in the same environment, he is said not to genuinely know.',
      'Intelligibility': 'The study of the different modes by which we make sense of things — conceptually, explanatorily, logically, phenomenologically, and contextually.',
      'Conceptual': 'Intelligibility achieved by grasping the meaning of terms, definitions, and abstract ideas.',
      'Explanatory': 'Intelligibility achieved by understanding causal relationships, explanations, and reasons.',
      'Logical': 'Intelligibility achieved by grasping the validity of arguments and the consistency of ideas.',
      'Phenomenological': 'Intelligibility achieved by making sense of perceptions and subjective experiences.',
      'Contextual': 'Intelligibility achieved by understanding the relations that a thing has to other things in its context.',
      'Logic': 'The systematic study of valid reasoning, argument, and inference.',
      'Formal Logic': 'The study of inference using abstract formal systems.',
      'Propositional Logic': 'The branch of logic dealing with propositions and their logical relationships.',
      'Predicate Logic': 'The branch of logic that analyzes the internal structure of propositions using predicates and quantifiers.',
      'Modal Logic': 'The branch of logic dealing with necessity, possibility, and related concepts.',
      'Temporal Logic': 'The branch of logic dealing with time and temporal relationships.',
      'Fuzzy Logic': 'A form of logic that allows for degrees of truth rather than binary true/false values.',
      'Paraconsistent Logic': 'A form of logic that allows for contradictions without trivializing the entire system.',
      'Symbolic Logic': 'The use of symbols and formal notation to represent logical structures and reasoning.',
      'Reasoning': 'The process of drawing conclusions from premises through logical inference.',
      'Fallacies': 'Common errors or flaws in reasoning that undermine the logic of arguments.',
      'Set Theory': 'The mathematical study of collections of objects and their properties.',
      'Model Theory': 'The study of the relationships between formal languages and their interpretations.',
      'Aesthetics': 'The branch of philosophy that explores the nature of beauty, art, and taste.',
      'Beauty': 'The quality of being aesthetically pleasing or possessing qualities that give pleasure to the senses or mind.',
      'Classical Beauty': 'The conception of beauty based on harmony, proportion, and order derived from ancient Greek and Roman ideals.',
      'Kant on Beauty': 'Kant\'s theory that beauty is experienced through disinterested pleasure and universal subjective judgments.',
      'Aesthetic Experience': 'The distinctive mode of perceiving and responding to art, beauty, or aesthetic objects.',
      'Form and Content': 'The distinction between the structural elements of an artwork and its subject matter or meaning.',
      'Subjective Beauty': 'The view that beauty is dependent on individual perception and preference.',
      'Objective Beauty': 'The view that beauty is an inherent property of objects independent of individual perception.',
      'Art Theory': 'Philosophical inquiry into the nature, purpose, and value of art.',
      'Representationalism': 'The view that art represents or depicts objects, scenes, or ideas from reality.',
      'Formalism': 'The view that the value of art lies in its formal elements such as line, color, and composition.',
      'Expressionism': 'The view that art expresses the emotions, feelings, or inner states of the artist.',
      'Conceptual Art': 'Art in which the concept or idea is more important than the physical form or execution.',
      'Aestheticism': 'The view that art has intrinsic value and should be appreciated for its beauty alone.',
      'Institutional Theory': 'The view that art is defined by the practices and conventions of the art world.',
      'Taste': 'The capacity to make discerning judgments about aesthetic qualities.',
      'Sublime': 'An aesthetic quality involving awe, grandeur, or overwhelming beauty that transcends ordinary experience.',
      'Expression Theory': 'The view that art is valuable because it expresses human emotions and experiences.',
      'Political Philosophy': 'The study of fundamental questions about government, justice, rights, law, and the nature of political authority.',
      'History': 'The study of past human events, societies, and civilizations across time.',
      // Prehistory (correct-format keys matching current node labels)
      'Prehistory (3.3 million years ago - 3,200 BC)': 'The period of human history before the invention of writing, spanning from 3.3 million years ago to 3,200 BC.',
      'Stone Age (3.3 million years ago - 3,300 BC)': 'The prehistoric period when stone tools were predominantly used, spanning from 3.3 million years ago to 3,300 BC.',
      'Paleolithic Era (3.3 million years ago - 10,000 BC)': 'The Old Stone Age when early humans used stone tools and lived as hunter-gatherers, from 3.3 million years ago to 10,000 BC.',
      'Lower Paleolithic (3.3 million years ago - 300,000 years ago)': 'The earliest phase of the Stone Age marked by the first stone tools and early human ancestors.',
      'Middle Paleolithic (300,000 years ago - 40,000 years ago)': 'The Stone Age period associated with Neanderthals and early Homo sapiens, featuring more sophisticated tools.',
      'Early Middle Paleolithic (300,000 years ago - 120,000 years ago)': 'The initial phase of the Middle Paleolithic with developing tool technologies and early human migration.',
      'Last Glacial Period, Middle Paleolithic (120,000 years ago - 40,000 years ago)': 'The Ice Age during the Middle Paleolithic when much of the northern hemisphere was covered by glaciers.',
      'Upper Paleolithic (40,000 years ago - 10,000 BC)': 'The Late Stone Age period marked by modern human expansion, cave art, and advanced tools.',
      'Last Glacial Period, Upper Paleolithic (40,000 years ago - 10,000 BC)': 'The final phase of the Ice Age during which modern humans spread across continents and developed sophisticated cultures.',
      'Younger Dryas Event, Upper Paleolithic (10,875 BC - 10,000 BC)': 'A dramatic cold snap interrupting the warming trend at the end of the Ice Age.',
      'Mesolithic Era (10,000 BC - 8,000 BC)': 'The Middle Stone Age transitional period between Paleolithic hunter-gatherers and Neolithic farmers.',
      'Last Glacial Period End, Mesolithic (10,000 BC - 9,675 BC)': 'The final phase of the Ice Age as glaciers retreated and climate warmed.',
      'Younger Dryas Event, Mesolithic (10,000 BC - 9,675 BC)': 'The continuation of the Younger Dryas cold period into the Mesolithic era.',
      'Younger Dryas End, Late Mesolithic (9,675 BC - 9,575 BC)': 'The conclusion of the Younger Dryas cold event, marking rapid climate warming.',
      'Late Mesolithic (9,675 BC - 8,000 BC)': 'The final phase of the Mesolithic era, marked by continued adaptation to post-glacial environments.',
      'Neolithic Era (8,000 BC - 4,500 BC)': 'The New Stone Age marked by the development of agriculture, animal domestication, and permanent settlements.',
      'Copper Age (4,500 BC - 3,300 BC)': 'The transitional period between the Stone Age and Bronze Age, marked by the first use of copper tools.',
      'Sumerian Civilization (4,100 BC - 3,300 BC)': 'The first major urban civilization in Mesopotamia, credited with inventing writing, the wheel, and complex governance.',
      'Uruk Period (4,100 BC - 3,300 BC)': 'The formative phase of Sumerian civilization featuring the world\'s first cities and early cuneiform writing.',
      'Predynastic Egypt (4,100 BC - 3,300 BC)': 'The period before unified Egyptian rule, characterized by the development of agriculture and early religious practices along the Nile.',
      'Ebla Civilization (3,500 BC - 3,300 BC)': 'An early Syrian city-state that was one of the earliest kingdoms in the Near East, known for its extensive trade networks.',
      'Early Bronze Age (3,300 BC - 3,200 BC)': 'The transitional phase bridging Prehistory and Ancient History, marked by the earliest adoption of bronze technology.',
      'Indus Valley Civilization (3,300 BC - 3,200 BC)': 'One of the world\'s earliest urban civilizations, known for sophisticated city planning, drainage systems, and standardized weights.',
      'Cycladic Civilization (3,300 BC - 3,200 BC)': 'A Bronze Age culture of the Cycladic islands in the Aegean Sea, known for distinctive marble figurines and seafaring.',
      // Ancient History (correct-format keys)
      'Ancient History (3,200 BC - 476 AD)': 'The era of the earliest civilizations, from the invention of writing (3,200 BC) to the fall of the Western Roman Empire (476 AD).',
      'Ancient Egypt (3,100 BC - 30 BC)': 'The civilization along the Nile River known for pyramids, pharaohs, and hieroglyphic writing, from 3,100 BC to 30 BC.',
      'Ancient Mesopotamia (3,500 BC - 539 BC)': 'The region between the Tigris and Euphrates rivers, cradle of civilization with Sumerians, Babylonians, and Assyrians.',
      'Ancient India (3,300 BC - 600 AD)': 'The early civilizations of the Indian subcontinent including the Indus Valley and Vedic periods.',
      'Ancient China (2,070 BC - 220 AD)': 'Early Chinese civilization including the Shang, Zhou, Qin, and Han dynasties.',
      'Ancient Greece (800 BC - 146 BC)': 'The civilization that developed philosophy, democracy, and classical art, from 800 BC to 146 BC.',
      'Ancient Rome (753 BC - 476 AD)': 'The civilization that grew from a city-state to an empire dominating the Mediterranean world.',
      // Medieval (correct-format keys)
      'Medieval Period (476 - 1453)': 'The historical period spanning from 476 to 1453, characterized by feudalism, the dominance of the Church in Europe, and ending with the fall of Constantinople.',
      'Early Middle Ages (476 - 1000)': 'The period following the fall of Rome marked by the rise of Christianity and formation of new kingdoms.',
      'High Middle Ages (1000 - 1250)': 'The period of population growth, urbanization, and cultural flourishing including Gothic architecture and scholasticism.',
      'Byzantine Empire (330 - 1453)': 'The continuation of the Eastern Roman Empire preserving classical knowledge and Christian Orthodoxy, from 330 to 1453.',
      'Islamic Golden Age (750 - 1258)': 'The period of scientific, cultural, and economic flourishing in the Islamic world, from 750 to 1258.',
      // Modern Era (correct-format keys)
      'Modern Era (1453 - present)': 'The period from 1453 to the present, marked by the transition from medieval to contemporary society.',
      'Early Modern Period (1453 - 1789)': 'A period of significant cultural, intellectual, and political transformation including the Renaissance, Reformation, and Enlightenment.',
      'Renaissance (1300 - 1600)': 'The cultural rebirth in Europe marked by renewed interest in classical learning, art, and humanism.',
      'Age of Discovery (1400 - 1800)': 'The period of European exploration and colonization of the Americas, Africa, and Asia.',
      'Reformation (1517 - 1648)': 'The religious movement that split Western Christianity and led to the Protestant churches.',
      'Enlightenment (1637 - 1800)': 'The intellectual movement emphasizing reason, science, and individual rights.',
      'Scientific Revolution (1543 - 1687)': 'The period of major advances in science that laid the foundation of modern science.',
      'Late Modern Period (1789 - 1945)': 'The period from 1789 to 1945, marked by industrialization, imperialism, world wars, and major social upheaval.',
      'Industrial Revolution (1760 - 1840)': 'The transformation from agrarian to industrial society through mechanization and technological innovation.',
      'Age of Revolutions (1774 - 1849)': 'The period of political upheaval with revolutions in America, France, and Latin America.',
      'Imperialism (1800 - 1945)': 'The expansion of European powers through colonization and control of territories worldwide.',
      'Italy (1800 - 1945)': 'Italy\'s turbulent journey from fragmented states through unification and into the Fascist era, culminating in World War II.',
      'Mussolini\'s Campaign Against the Mafia (1925 - 1929)': 'Mussolini\'s aggressive crackdown on the Sicilian Mafia using special police powers, temporarily suppressing organized crime in Sicily.',
      'Middle East Conflict (1882 - 1945)': 'The complex political, demographic, and military struggle in Ottoman and then Mandatory Palestine between Jewish immigrants and Arab inhabitants, shaped by great-power interests.',
      'Aliyahs (1882 - 1948)': 'The successive waves of Jewish immigration to Ottoman and British Mandatory Palestine that built the demographic foundation of the future State of Israel.',
      'First Aliyah (1882 - 1903)': 'The first major wave of Zionist immigration to Ottoman Palestine, primarily from Eastern Europe, establishing early agricultural settlements.',
      'Second Aliyah (1904 - 1914)': 'The second major wave of Jewish immigration to Palestine, dominated by idealistic socialist pioneers who founded the kibbutz movement.',
      'Third Aliyah (1919 - 1923)': 'A wave of immigration following World War I and the Balfour Declaration, strengthening Jewish agricultural and labor institutions in Palestine.',
      'Fourth Aliyah (1924 - 1928)': 'A wave of primarily middle-class Jewish immigrants from Poland fleeing economic hardship, accelerating urbanization in Palestine.',
      'Fifth Aliyah (1929 - 1939)': 'The largest immigration wave, driven largely by the rise of Nazism in Germany, significantly expanding the Jewish population and economic development of Palestine.',
      'Aliyah Bet (1934 - 1948)': 'Clandestine Jewish immigration to Palestine carried out in defiance of British restrictions, organized to rescue Jews from persecution in Europe.',
      'Balfour Declaration (1917)': 'A letter from British Foreign Secretary Arthur Balfour declaring British support for the establishment of a national home for the Jewish people in Palestine.',
      'End of Ottoman Palestine (1918)': 'The defeat of the Ottoman Empire in World War I ended centuries of Ottoman rule over Palestine, opening the door to British administration.',
      'British Military Administration (1918 - 1920)': 'The transitional period of British military rule over Palestine following Ottoman defeat, preceding the formal League of Nations Mandate.',
      'League of Nations Mandate (1920)': 'The formal international authorization granted to Britain at the San Remo Conference to govern Palestine and fulfill the Balfour Declaration.',
      'Haganah (1920)': 'The main Jewish paramilitary organization in Mandatory Palestine, founded in 1920 to defend Jewish settlements and later serving as the foundation of the Israel Defense Forces.',
      'British Mandate for Palestine (1923 - 1948)': 'The period of formal British administration over Palestine under League of Nations authority, marked by escalating conflict between Jewish and Arab communities.',
      'Western Wall Uprising (1929)': 'A week of Arab riots and Jewish-Arab violence sparked by disputes over Jewish prayer rights at the Western Wall, resulting in hundreds of casualties.',
      'Arab Revolt (1936 - 1939)': 'A nationalist uprising by Palestinian Arabs against British rule and Jewish immigration, involving a general strike and armed rebellion.',
      'Peel Commission (1937)': 'A British royal commission that recommended partitioning Palestine into separate Jewish and Arab states — the first formal partition proposal.',
      'British White Paper (1939)': 'British policy document severely limiting Jewish immigration to Palestine and restricting land sales, issued in response to the Arab Revolt.',
      'Jewish Insurgency in Mandatory Palestine (1944 - 1948)': 'Armed resistance by Jewish militant groups against British rule in Palestine, aimed at forcing Britain to allow unrestricted Jewish immigration and establish a Jewish state.',
      'Lehi (1940 - 1948)': 'A radical Zionist militant organization, also known as the Stern Gang, that fought against both British and Arab forces, employing assassination and bombings.',
      'Assassination of Lord Moyne (1944)': 'Lehi\'s assassination of British Minister of State Lord Moyne in Cairo, intended to pressure Britain over its Palestine policy.',
      'World Wars Era (1914 - 1945)': 'The period encompassing World War I, the turbulent Interwar Period, and World War II, collectively reshaping the global order and modern geopolitics.',
      'World War I (1914 - 1918)': 'The global conflict involving major world powers, from 1914 to 1918.',
      'Western Front (1914 - 1918)': 'The grueling trench warfare front in Belgium and France where Germany faced Allied forces, defining the dominant image of World War I.',
      'Eastern Front (1914 - 1917)': 'The vast and mobile theater of World War I stretching from the Baltic to the Black Sea, primarily between Germany, Austria-Hungary, and Russia.',
      'Italian Front (1915 - 1918)': 'The theater of World War I along the border between Italy and Austria-Hungary, featuring brutal mountain warfare in the Alps and Isonzo River valley.',
      'Balkan Front (1914 - 1918)': 'The theater of operations in southeastern Europe involving Serbia, Austria-Hungary, Bulgaria, and Allied forces on the Salonika front.',
      'Middle Eastern Front (1914 - 1918)': 'The campaigns in the Ottoman territories of Palestine, Mesopotamia, and the Arabian Peninsula, leading to the eventual collapse of the Ottoman Empire.',
      'African Campaigns (1914 - 1918)': 'Military operations across German colonial possessions in Africa, where Allied forces worked to neutralize German colonial garrisons.',
      'Caucasus Campaign (1914 - 1918)': 'The fighting between the Ottoman Empire and Russia in the Caucasus region, characterized by harsh terrain and extreme winter conditions.',
      'Gallipoli Campaign (1915 - 1916)': 'The Allied attempt to seize the Dardanelles Strait and knock the Ottoman Empire out of the war, ending in a costly withdrawal.',
      'Naval War (1914 - 1918)': 'The maritime dimension of World War I, including the British naval blockade of Germany, the Battle of Jutland, and Germany\'s unrestricted submarine warfare.',
      'America in World War I (1917 - 1918)': 'The United States entered the war in April 1917, providing fresh troops and resources that helped tip the balance toward the Allied powers.',
      'Interwar Period (1918 - 1939)': 'The period between the world wars marked by economic depression and the rise of totalitarianism.',
      'Germany in the Interwar Period (1919 - 1939)': 'Germany\'s turbulent journey from defeat and the Weimar Republic through economic crisis to the rise of National Socialism and Hitler\'s consolidation of power.',
      'Munich Agreement (1938)': 'The agreement permitting Nazi Germany to annex the Sudetenland of Czechoslovakia, symbolizing the failure of appeasement and enabling further German aggression.',
      'World War II (1939 - 1945)': 'The global conflict between Allied and Axis powers, the deadliest war in history.',
      'America in World War II (1941 - 1945)': 'The United States\' involvement following Pearl Harbor, contributing decisive industrial power, military force, and intelligence operations across all theaters.',
      'Operation Underworld (1942 - 1945)': 'A secret U.S. Navy collaboration with the American Mafia, especially Lucky Luciano, to protect the New York waterfront from Axis sabotage and gain intelligence for the Sicily invasion.',
      'OSS (1942 - 1945)': 'The Office of Strategic Services, the wartime U.S. intelligence agency that conducted espionage, sabotage, and support for resistance movements in occupied territories.',
      'SS Normandie (1942)': 'The fire and capsizing of the French luxury liner Normandie in New York Harbor while being converted to a troopship, investigated for potential Axis sabotage.',
      'Manhattan Project (1942 - 1945)': 'The secret U.S.-led research and development program that produced the first nuclear weapons, culminating in the atomic bombings of Japan.',
      'European Theater (1939 - 1945)': 'The main theater of World War II spanning western, eastern, and southern Europe, where Allied forces ultimately defeated Nazi Germany.',
      'Western Front (1939 - 1945)': 'The theater of World War II in Western Europe, from the fall of France through D-Day and the liberation of Western Europe to Germany\'s defeat.',
      'Eastern Front (1941 - 1945)': 'The largest and bloodiest theater of World War II, fought between Nazi Germany and the Soviet Union across Eastern Europe, resulting in tens of millions of casualties.',
      'Italian Campaign (1943 - 1945)': 'The Allied campaign to drive Axis forces from Italy, beginning with the Sicily invasion and ending with Germany\'s surrender in Italy in May 1945.',
      'Balkan Campaign (1940 - 1945)': 'Military operations in the Balkans including Italy\'s invasion of Greece, German intervention, and fierce partisan warfare throughout occupied Yugoslavia and Greece.',
      'Atlantic Theater (1939 - 1945)': 'The naval campaign for control of the Atlantic, centered on Germany\'s U-boat campaign against Allied shipping and the Allied convoy system developed to counter it.',
      'MENA Campaign (1940 - 1943)': 'The Middle East and North Africa campaign, primarily the struggle for control of North Africa between the Allies and Axis powers, ending with the Axis surrender in Tunisia.',
      'Pacific Theater (1941 - 1945)': 'The theater of World War II across the Pacific Ocean and Asia, initiated by Japan\'s attack on Pearl Harbor and ending with Japan\'s surrender.',
      'Attack on Pearl Harbor (1941)': 'The surprise Japanese naval air attack on the U.S. naval base at Pearl Harbor, Hawaii, that brought the United States into World War II.',
      'Battle of Midway (1942)': 'A decisive naval battle in which U.S. forces sank four Japanese aircraft carriers, marking a turning point in the Pacific War.',
      'Atomic Bombings of Hiroshima and Nagasaki (1945)': 'The U.S. detonation of atomic bombs over two Japanese cities in August 1945, killing over 100,000 people and precipitating Japan\'s surrender.',
      'China-Burma-India Theater (1937 - 1945)': 'The theater encompassing military operations in China, Burma, and India, including efforts to keep China in the war and maintain supply routes over the Himalayas.',
      'End of World War II (1945)': 'The final phase of World War II culminating in the unconditional surrender of Germany and Japan, ending the deadliest conflict in human history.',
      'German Surrender (1945)': 'Germany\'s unconditional surrender signed on May 8, 1945 (V-E Day), ending World War II in Europe.',
      'Japanese Surrender (1945)': 'Japan\'s unconditional surrender announced August 15 and formally signed September 2, 1945 (V-J Day), ending World War II.',
      'Contemporary Period (1945 - present)': 'The period from 1945 to the present, shaped by decolonization, the Cold War, technological advancement, and globalization.',
      'Post-World War II Era (1945 - 1947)': 'The brief transitional period immediately following World War II, marked by the fracturing of the wartime alliance and the beginning of postwar reconstruction.',
      'Iron Curtain Speech (1946)': 'Churchill\'s 1946 Fulton, Missouri speech warning that an "iron curtain" had descended across Europe, dividing the Western and Soviet blocs and publicly framing the emerging Cold War.',
      'Indian and Pakistani Independence (1947)': 'The August 14–15, 1947 end of British rule over India, simultaneously creating the independent dominions of India and Pakistan in a partition accompanied by massive displacement and communal violence.',
      'Industrial Age (1945 - 1980)': 'The postwar era of continued rapid industrialization, mass production, and technological innovation that profoundly shaped global economies and societies.',
      'Cold War Era (1947 - 1991)': 'The period of geopolitical tension between the United States and Soviet Union spanning from 1947 to 1991, characterized by ideological rivalry, proxy wars, nuclear brinkmanship, and ultimately the dissolution of the USSR.',
      'USSR during the Cold War (1947 - 1991)': 'The Soviet Union\'s role as global superpower competitor to the United States, from its atomic bomb test through de-Stalinization, Gorbachev\'s reforms, and final dissolution in 1991.',
      'Joe-1 Atomic Bomb Test (1949)': 'The Soviet Union\'s first successful atomic bomb test on August 29, 1949, breaking the U.S. nuclear monopoly and triggering the nuclear arms race.',
      'Death of Joseph Stalin (1953)': 'The death of Soviet leader Joseph Stalin in March 1953, which initiated political uncertainty, a power struggle, and ultimately the era of de-Stalinization under Khrushchev.',
      "Khrushchev's Secret Speech (1956)": 'Nikita Khrushchev\'s February 1956 "On the Cult of Personality" address denouncing Stalin\'s purges and personality cult, reaching the West after a copy was leaked through Israeli intelligence channels to the CIA and then the New York Times.',
      'Mikhail Gorbachev Becomes General Secretary (1985)': 'Gorbachev\'s election as General Secretary of the Communist Party on March 11, 1985, initiating the reform policies of glasnost and perestroika that ultimately reshaped the Soviet Union and ended the Cold War.',
      'Chernobyl Nuclear Disaster (1986)': 'The April 26, 1986 catastrophic meltdown of Reactor No. 4 at the Chernobyl Nuclear Power Plant in Ukraine, releasing massive radioactive contamination and accelerating Soviet decline.',
      'Dissolution of the USSR (1991)': 'The formal dissolution of the Soviet Union on December 26, 1991, when the Supreme Soviet voted to end the world\'s first communist state, concluding the Cold War.',
      'America during the Cold War Era (1947 - 1991)': 'The United States\' role as leader of the Western bloc during the Cold War, encompassing intelligence reform, proxy conflicts, nuclear standoffs, and major domestic political crises.',
      'National Security Act of 1947': 'The July 1947 legislation that unified the U.S. military under a new Department of Defense and created the Central Intelligence Agency, restructuring American national security for the Cold War.',
      "American Concerns over Israel's Nuclear Program (1960 - 1991)": 'A sustained but ultimately unsuccessful U.S. effort from 1960 onward to prevent or monitor Israel\'s covert nuclear weapons development at the Dimona reactor, hampered by Israeli evasion and internal CIA obstruction.',
      'CIA Dimona Discovery (1960)': 'The December 1960 CIA Special National Intelligence Estimate revealing that Israel was building a major nuclear facility in the Negev desert aimed at producing nuclear weapons.',
      'Kennedy-Ben-Gurion Dimona Negotiations (1961 - 1963)': 'President Kennedy\'s sustained diplomatic pressure on Israeli leaders for regular U.S. inspections of the Dimona nuclear facility, met with consistent Israeli delays and evasion until Kennedy\'s assassination ended the effort.',
      'Dimona Reactor Goes Critical (1963)': 'The Dimona nuclear reactor achieved criticality in late December 1963, one month after President Kennedy\'s assassination, which had effectively ended firm U.S. pressure for inspections.',
      'Dimona Inspection (1964)': 'A January 1964 U.S. inspection team visit to Dimona that found evidence the reactor had gone critical, but access remained tightly controlled by Israeli officials.',
      'JFK Presidency (1961 - 1963)': 'The administration of the 35th U.S. president, marked by the Bay of Pigs failure, Cuban Missile Crisis, nuclear pressure on Israel, and assassination on November 22, 1963.',
      'Inauguration of JFK (1961)': 'John F. Kennedy was inaugurated as the 35th President of the United States on January 20, 1961.',
      'Allen Dulles Replaced by John McCone (1961)': 'Following the Bay of Pigs disaster, President Kennedy replaced CIA Director Allen Dulles with John McCone on November 29, 1961, seeking to reform the agency.',
      'Operation Northwoods (1962)': 'A March 1962 proposed CIA plan to stage false-flag attacks and blame them on Cuba to justify a U.S. military invasion, rejected by President Kennedy.',
      'Assassination of President John F. Kennedy (1963)': 'The November 22, 1963 killing of President Kennedy in Dallas, Texas, by Lee Harvey Oswald, with ongoing public debate about whether additional parties were involved.',
      'JFK Motorcade and Shooting (1963)': 'Kennedy\'s motorcade through Dallas on November 22, 1963, during which three shots were fired from the Texas School Book Depository, killing the president and wounding Governor Connally.',
      'Lee Harvey Oswald (1939 - 1963)': 'The accused assassin of President Kennedy — a former Marine who defected to the Soviet Union, returned to the U.S., and was surveilled by the CIA for years before the assassination.',
      'Oswald Defects to the Soviet Union (1959)': 'Lee Harvey Oswald resigned from the Marines and defected to the Soviet Union in October 1959, initiating CIA surveillance of his mail under the HTLINGUAL program.',
      'Oswald under Custody (1963)': 'Oswald was arrested at the Texas Theatre on November 22 after killing Dallas police officer J.D. Tippit, and repeatedly claimed "I\'m just a patsy" during subsequent interrogation.',
      'Assassination of Lee Harvey Oswald (1963)': 'Jack Ruby shot and killed Oswald on November 24, 1963, as he was being transferred from Dallas Police Headquarters, preventing any trial.',
      'Jack Ruby (1911 - 1967)': 'Dallas nightclub owner Jacob Rubenstein who shot Oswald, with documented connections to organized crime figures including members of the Dallas crime family and associates of Meyer Lansky.',
      'Warren Commission (1963 - 1964)': 'The presidential commission led by Chief Justice Earl Warren that investigated Kennedy\'s assassination and concluded in September 1964 that Oswald acted alone.',
      'LBJ Becomes President (1963)': 'Vice President Lyndon B. Johnson was sworn in as the 36th President following Kennedy\'s assassination, and subsequently adopted a less confrontational stance toward Israel\'s nuclear program.',
      'Alternate Theories': 'Alternative theories challenging the Warren Commission\'s lone gunman conclusion.',
      'Mossad Killed Kennedy': 'The theory that Israeli intelligence orchestrated Kennedy\'s assassination in response to his pressure on Israel to open its Dimona nuclear facility to international inspection.',
      'James Angleton and CIA-Mob Connection': 'CIA counterintelligence chief James Angleton maintained compartmentalized ties to both the Mossad and organized crime, oversaw Oswald\'s mail surveillance, and controlled the flow of information about Oswald within the CIA.',
      'James Angleton (1917 - 1987)': 'Intensely anti-Communist CIA counterintelligence chief, primary CIA liaison to Israeli intelligence (1951–1954), head of the HTLINGUAL mail interception program, and architect of extreme compartmentalization within the CIA.',
      'HTLINGUAL Mail Interception Program (1952 - 1973)': 'A secret CIA mail-opening program active from 1952 to 1973 targeting U.S.-Soviet correspondence; Angleton assigned Reuben Efron to surveil Oswald\'s mail, producing a 180-page dossier in the week before the assassination.',
      "Motive: Israel's Nuclear Program vs. JFK": 'Israel urgently wanted a nuclear deterrent; Kennedy firmly opposed it. JFK\'s replacement by the more permissive LBJ, and the Dimona reactor going critical one month after the assassination, represents the principal motive in this theory.',
      'Evidence for Israeli Involvement': 'Evidence cited includes Dimona going critical a month after JFK\'s death, Angleton\'s documented Mossad ties, Regency Enterprises (owned by Israeli arms smuggler Arnon Milchan) producing Oliver Stone\'s "JFK" as a diversion, and Israel\'s history of bold covert operations.',
      'Church Committee (1975 - 1976)': 'The 1975–1976 Senate Select Committee led by Senator Frank Church that investigated CIA, FBI, and intelligence agency abuses, exposing assassination plots, illegal surveillance programs, and Angleton\'s compartmentalized activities.',
      'CIA Assassination Plots Against Castro': 'The Church Committee uncovered multiple CIA plots to assassinate Fidel Castro, including operations via the Mob involving Sam Giancana and John Roselli, poisoned cigars, and exploding seashells.',
      "James Angleton's Testimony": 'Angleton\'s evasive Church Committee testimony, when asked whether Israeli agents had attempted to acquire U.S. nuclear secrets, strongly implied he had facilitated the transfer of nuclear information to Israel, saying only "that doesn\'t exclude the Israelis."',
      'Israel during the Cold War Era (1948 - 1991)': 'Israel\'s development as a regional military power during the Cold War, covertly acquiring nuclear weapons capability despite U.S. opposition.',
      'Dimona Nuclear Reactor (1958 - 1964)': 'Israel\'s covert nuclear reactor built with significant French assistance beginning in 1958, which became operational in 1963, providing the plutonium production capability for Israel\'s nuclear weapons program.',
      'Arms Race (1947 - 1991)': 'The competitive buildup of nuclear and conventional military power between the United States and Soviet Union, driven by mutual fear of annihilation and ideological conflict.',
      'China during the Cold War Era (1947 - 1991)': 'China\'s role during the Cold War, including the communist revolution, the Great Leap Forward, the Sino-Soviet split, and eventual normalization with the United States.',
      'Great Leap Forward (1958)': 'Mao Zedong\'s 1958–1962 economic and social campaign to rapidly transform China into a communist industrial state, resulting in widespread famine and tens of millions of deaths.',
      'NATO (1949)': 'The North Atlantic Treaty Organization, established in 1949 as a military alliance of Western nations to provide collective defense against Soviet expansion.',
      'Two Germanys (1949 - 1990)': 'The division of Germany into the democratic Federal Republic (West) and communist Democratic Republic (East) from 1949 to reunification in 1990, symbolizing the Cold War\'s division of Europe.',
      'Construction of the Berlin Wall (1961)': 'East Germany erected barriers beginning August 13, 1961, to halt the exodus of its citizens to West Berlin, reinforced into a concrete wall that stood until 1989.',
      'Fall of the Berlin Wall (1989)': 'On November 9, 1989, East Germany opened its border crossings, and crowds tore down the Berlin Wall, symbolizing the collapse of communist regimes across Eastern Europe.',
      'Reunification of Germany (1990)': 'East and West Germany officially reunified on October 3, 1990, ending four decades of division and symbolizing the conclusion of the Cold War in Europe.',
      'Korean War (1950 - 1953)': 'The 1950–1953 conflict triggered by North Korea\'s invasion of South Korea, drawing in UN forces led by the United States and resulting in an armistice that left Korea divided.',
      'Warsaw Pact (1955)': 'A Soviet-led military alliance of Eastern Bloc countries formed in 1955 in response to West Germany\'s integration into NATO.',
      'Space Race (1957 - 1975)': 'The competition between the United States and Soviet Union for spaceflight superiority, from Sputnik in 1957 through the Apollo moon landings to the joint Apollo-Soyuz mission in 1975.',
      'Sputnik 1 (1957)': 'The Soviet Union\'s October 1957 launch of the world\'s first artificial satellite, marking the beginning of the Space Age and escalating Cold War competition.',
      'Apollo Program (1961 - 1972)': 'The U.S. program that successfully landed humans on the Moon, achieving a defining Cold War victory and one of the greatest technological feats in history.',
      'Apollo 11 Moon Landing (1969)': 'The July 20, 1969 landing of astronauts Neil Armstrong and Buzz Aldrin on the Moon, fulfilling Kennedy\'s 1961 challenge and marking the climax of the Space Race.',
      'Strategic Defense Initiative (1983)': 'President Reagan\'s March 1983 proposal for a space-based missile defense system (nicknamed "Star Wars") that heightened Cold War tensions by threatening to neutralize Soviet nuclear deterrence.',
      'Vietnam War (1955 - 1975)': 'The Cold War-era conflict in Southeast Asia in which the United States intervened to prevent communist North Vietnam from unifying the country, ending in U.S. withdrawal and communist victory in 1975.',
      'Gulf of Tonkin Incident (1964)': 'The August 2–4, 1964 alleged attacks on U.S. naval vessels by North Vietnamese forces that provided the justification for escalating U.S. military involvement.',
      'Gulf of Tonkin Resolution (1964)': 'The August 7, 1964 congressional resolution granting President Johnson broad authority to escalate military involvement in Vietnam without a formal declaration of war.',
      'Escalation of the Vietnam War (1965 - 1966)': 'The dramatic increase in U.S. military involvement in 1965–1966 including deployment of combat troops, intensified bombing campaigns, and deepening commitment to the conflict.',
      'Tet Offensive (1968)': 'The January 1968 series of coordinated surprise attacks by North Vietnamese and Viet Cong forces across South Vietnam that fundamentally shifted American public opinion against the war.',
      'Fall of Saigon (1975)': 'The April 30, 1975 capture of the South Vietnamese capital by North Vietnamese forces, ending the Vietnam War with communist unification of Vietnam.',
      'Cuban Revolution (1959)': 'Fidel Castro\'s overthrow of the Fulgencio Batista regime, establishing a socialist state in Cuba aligned with the Soviet Union and triggering decades of U.S.-Cuba hostility.',
      'Bay of Pigs Invasion (1961)': 'The April 1961 failed attempt by a CIA-trained force of Cuban exiles to invade Cuba and overthrow Fidel Castro, a major embarrassment for the Kennedy administration.',
      'Operation Mongoose (1961 - 1962)': 'A covert CIA operation authorized by President Kennedy aiming to destabilize and overthrow the Cuban government through sabotage, propaganda, and assassination plots coordinated with the Mob.',
      'Cuban Missile Crisis (1962)': 'The October 1962 thirteen-day confrontation between the U.S. and Soviet Union after U-2 reconnaissance revealed Soviet nuclear missiles in Cuba, bringing the world to the brink of nuclear war.',
      'U-2 Spy Plane Discovery (1962)': 'The October 14, 1962 U-2 reconnaissance photographs revealing Soviet nuclear missile sites under construction in Cuba, triggering the Cuban Missile Crisis.',
      'ExComm Deliberations (1962)': 'President Kennedy\'s Executive Committee of the National Security Council debated responses to the Cuban missiles from October 16–22, 1962, before recommending a naval quarantine.',
      'Naval Quarantine of Cuba (1962)': 'President Kennedy\'s October 22 announcement of a naval "quarantine" of Cuba to prevent Soviet missiles reaching the island, followed by tense days as Soviet ships approached the blockade line.',
      'Resolution of the Cuban Missile Crisis (1962)': 'Khrushchev announced Soviet missile withdrawal on October 28 following secret U.S. pledges not to invade Cuba and to remove Jupiter missiles from Turkey, ending the crisis on November 20.',
      'Nuclear Non-Proliferation Treaty (1968)': 'The 1968 international treaty signed by 189 countries aimed at preventing the spread of nuclear weapons and weapons technology, promoting disarmament, and enabling peaceful nuclear energy use.',
      'INF Treaty (1987)': 'The December 1987 Intermediate-Range Nuclear Forces Treaty in which the U.S. and Soviet Union agreed to eliminate their intermediate-range nuclear missiles, a landmark Cold War arms reduction.',
      // Middle East (contemporary) summaries
      'Middle East Conflict (1945 - present)': 'The ongoing complex of conflicts, political struggles, and wars in the Middle East and North Africa from 1945 to the present, centered on the Arab-Israeli conflict, regional power competition, and great-power involvement.',
      'Arab League Creation (1945)': 'The Arab League was founded on March 22, 1945, to promote political, economic, and cultural cooperation among Arab states and coordinate opposition to Zionist immigration and Jewish statehood.',
      'Aliyahs (1945 - present)': 'The successive waves of Jewish immigration to Mandatory Palestine and then Israel from 1945 onward, continuing to reshape Israel\'s demographic character into the present.',
      'Aliyah Bet (1945 - 1947)': 'The greatly intensified clandestine immigration of Holocaust survivors to Mandatory Palestine in defiance of British quotas, drawing international attention to displaced Jews.',
      'Post-Independence Mass Aliyah (1948 - 1951)': 'The rapid immigration of approximately 700,000 Jews to the newly established State of Israel, doubling Israel\'s Jewish population in its first three years.',
      'Law of Return (1950)': 'Israel\'s 1950 legislation granting every Jew worldwide the right to immigrate and receive citizenship, embodying Israel\'s foundational mission as a Jewish homeland.',
      'Aliyah from Arab and Muslim Countries (1948 - 1970)': 'The mass exodus of nearly one million Jews from Middle Eastern and North African nations to Israel, driven by escalating antisemitism following Israeli independence.',
      'Aliyah from the Soviet Union and Eastern Bloc (1970 - 1991)': 'Significant emigration of Soviet and Eastern Bloc Jews to Israel driven by international pressure, thawing emigration restrictions, and the desire to escape antisemitism.',
      'Jewish Insurgency (1945 - 1948)': 'Intensified armed resistance by Haganah, Irgun, and Lehi against British rule in Mandatory Palestine, aimed at forcing Britain\'s withdrawal and establishing a Jewish state.',
      'Haganah (1945 - 1948)': 'The main Jewish paramilitary organization that combined above-ground settlement defense with clandestine immigration operations and arms procurement during the final years of British rule.',
      'Weapons Procurement / Rekhesh (1945 - 1948)': 'Clandestine Haganah arms-smuggling operations using Italian ports as primary transit points, with assistance from American Jewish Mafia figures including Meyer Lansky and Bugsy Siegel.',
      'Irgun (1945 - 1948)': 'A right-wing Zionist militant group that conducted attacks on British military bases, police stations, and infrastructure to force a British withdrawal from Palestine.',
      'King David Hotel Bombing (1946)': 'The Irgun\'s July 1946 bombing of the British administrative headquarters in the King David Hotel in Jerusalem, killing 91 people.',
      'Lehi (1945 - 1948)': 'The Stern Gang, a radical Zionist militant group that carried out targeted assassinations and direct action with little regard for civilian casualties in pursuit of British expulsion from Palestine.',
      'UN Partition Plan for Palestine (1947)': 'The November 29, 1947 UN General Assembly resolution recommending division of the British Mandate into separate Arab and Jewish states, accepted by Jewish leadership but rejected by the Arab League.',
      'Civil War in Mandatory Palestine (1947 - 1948)': 'The escalating communal violence between Jewish and Arab communities following the UN Partition Plan, beginning with an Arab bus ambush in November 1947 and leading to full-scale war.',
      'Deir Yassin Massacre (1948)': 'The April 9, 1948 attack by Irgun and Lehi forces on the Arab village of Deir Yassin, killing many residents and triggering widespread Arab flight.',
      'Haganah Captures (1948)': 'A series of Haganah offensives in April–May 1948 capturing Tiberias, Haifa, Safed, and Jaffa, establishing Jewish control of key urban centers before Israel\'s declaration of independence.',
      '1948 Arab-Israeli War (1948 - 1949)': 'The war triggered by Israel\'s declaration of independence, as Arab coalition forces invaded and Israel expanded its territory while a large Palestinian population was displaced.',
      'Declaration of Israeli Independence (1948)': 'David Ben-Gurion\'s proclamation of the State of Israel on May 14, 1948, hours before the British Mandate expired.',
      'Arab Coalition Invasion (1948)': 'Egypt, Transjordan, Iraq, Syria, Lebanon, Saudi Arabia, and Yemen invaded the newly declared State of Israel on May 15, 1948.',
      'Nakba (1948)': 'The "catastrophe" — the mass displacement and dispossession of approximately 700,000 Palestinians during the 1948 war, creating a refugee crisis that persists to the present.',
      'Israeli Military Operations (1948)': 'A series of Israeli offensives in 1948 including Operations Dani, Yoav, Hiram, and Horev that secured control of key territories and forced Egyptian forces to seek an armistice.',
      'Operation Dani (1948)': 'The July 1948 Israeli offensive capturing Lydda and Ramle, securing the road to Jerusalem.',
      'Operation Yoav (1948)': 'The October 1948 Israeli offensive in the Negev driving a wedge between Egyptian forces and securing Beersheba.',
      'Operation Hiram (1948)': 'The October 1948 swift Israeli offensive capturing the Upper Galilee from the Arab Liberation Army.',
      'Operation Horev (1948 - 1949)': 'The December 1948–January 1949 large-scale Israeli offensive against Egyptian forces in the Western Negev, pushing into the Sinai and forcing Egypt to seek an armistice.',
      'Armistice Agreements (1949)': 'A series of armistice agreements signed in 1949 between Israel and Egypt (Feb), Lebanon (Mar), Transjordan (Apr), and Syria (Jul), ending the 1948 war and establishing the Green Line borders.',
      'State of Israel (1948 - present)': 'The modern Jewish state established in 1948 that has developed from a fragile new nation into a regional military and technological power, acquiring undeclared nuclear weapons and multiple layered missile defense systems.',
      'Lavon Affair (1954)': 'A 1954 Israeli covert operation (Operation Susannah) in which Israeli agents recruited Egyptian Jews to bomb Western targets in Egypt and frame Egyptian nationalists, ending in exposure and political scandal.',
      'Oded Yinon Plan (1982)': 'A 1982 Israeli strategic document published in Kivunim proposing that Israel should promote the fragmentation of Arab states into smaller ethnic and sectarian entities to enhance Israeli regional security.',
      'Patriot Missile Defense System (1984)': 'A U.S.-made mobile surface-to-air missile system designed to intercept ballistic missiles, cruise missiles, and aircraft, deployed by Israel since 1984.',
      'Arrow 2 Missile Defense System (2000)': 'An Israeli missile defense system operational since 2000, designed to intercept short- and medium-range ballistic missiles within Earth\'s atmosphere.',
      'Iron Dome (2011)': 'An Israeli mobile air defense system operational since 2011, designed to intercept and destroy short-range rockets, artillery shells, and mortars.',
      'Arrow 3 Missile Defense System (2017)': 'An advanced Israeli system operational since 2017 designed for exo-atmospheric interception of long-range ballistic missiles using kinetic "hit-to-kill" technology.',
      "David's Sling (2017)": 'An Israeli-American missile defense system operational since 2017 designed to intercept medium- to long-range rockets and cruise missiles, bridging the gap between Iron Dome and the Arrow systems.',
      'Jordan Annexes the West Bank (1950)': 'Following its occupation during the 1948 war, Jordan formally annexed the West Bank in 1950, a move not widely recognized internationally.',
      'Palestinian Fedayeen Attacks (1951 - 1982)': 'Cross-border raids by Palestinian militants primarily from refugee communities targeting Israeli civilians, beginning after the 1948 war and often provoking major Israeli retaliation.',
      "Egypt's Support for Fedayeen (1954 - 1956)": 'Nasser\'s direct sponsorship and organization of Palestinian fedayeen groups from the Gaza Strip to launch raids into Israel, a key factor leading to the 1956 Suez Crisis.',
      'First Sudanese Civil War (1955 - 1972)': 'A protracted conflict between Sudan\'s Arab-Muslim north and the diverse Christian/animist south, arising from ethnic, religious, and cultural divisions following Sudanese independence.',
      'Suez Crisis (1956 - 1957)': 'The 1956 international incident triggered by Egypt\'s nationalization of the Suez Canal, leading to a secretly coordinated invasion by Israel, Britain, and France, reversed under U.S. and Soviet pressure.',
      'Nationalization of the Suez Canal (1956)': 'Egyptian President Nasser\'s July 26, 1956 seizure of the Suez Canal Company from its British and French shareholders, triggering a major international crisis.',
      'Protocol of Sèvres (1956)': 'A secret October 1956 agreement between Israel, France, and Britain to coordinate a staged military attack on Egypt, with France agreeing to cooperate with Israel\'s nuclear program as part of the deal.',
      'Suez Military Operations (1956)': 'Israel\'s invasion of the Sinai on October 29, followed by Anglo-French air strikes and airborne landings, aiming to seize the Suez Canal under the cover of separating Israeli and Egyptian forces.',
      'International Pressure and Withdrawal (1956 - 1957)': 'U.S. threats of economic sanctions and Soviet pressure forced Britain, France, and eventually Israel to withdraw, dealing a decisive blow to European colonial ambitions in the Middle East.',
      'Palestine Liberation Organization (1964)': 'Founded in 1964 at the directive of the Arab League to represent Palestinian people and advocate for self-determination, the PLO became the dominant Palestinian political body.',
      'Six-Day War (1967)': 'Israel\'s June 5–10, 1967 pre-emptive strike against Egypt, Jordan, and Syria, resulting in Israel\'s occupation of the Sinai, Gaza Strip, West Bank, East Jerusalem, and Golan Heights.',
      'USS Liberty Incident (1967)': 'The June 8, 1967 attack by Israeli air and naval forces on the U.S. Navy ship USS Liberty in international waters, killing 34 Americans, with ongoing controversy over whether the attack was deliberate.',
      'Yom Kippur War (1973)': 'The October 1973 surprise attack by Egypt and Syria aimed at reclaiming territories lost in 1967, ending in a UN-brokered ceasefire with both sides claiming partial success.',
      'Operation Nickel Grass (1973)': 'The massive U.S. strategic airlift that rapidly resupplied Israel with critical military equipment during the Yom Kippur War, helping turn the tide of the conflict.',
      'Israeli Election of 1977': 'The 1977 "Mahapakh" (upheaval) in which Menachem Begin\'s Likud party won for the first time, ending nearly three decades of Labor dominance and shifting Israel toward a more nationalist, expansionist ideology.',
      'Camp David Accords (1978)': 'The September 1978 U.S.-brokered framework agreement between Israel and Egypt that led to the 1979 Egypt-Israel Peace Treaty, the first Arab-Israeli peace agreement.',
      'First Israeli Invasion of Lebanon (1978)': 'Israel\'s March 1978 invasion of southern Lebanon aimed at pushing back PLO fighters and establishing a buffer zone, launching nearly two decades of Israeli military presence in Lebanon.',
      'Iranian Revolution (1979)': 'The January–April 1979 overthrow of the Shah\'s regime and establishment of an Islamic Republic under Ayatollah Khomeini, fundamentally reshaping the Middle East.',
      'Egypt-Israel Peace Treaty (1979)': 'The March 26, 1979 treaty formally ending the state of war between Egypt and Israel following the Camp David Accords, including Israel\'s full withdrawal from the Sinai Peninsula.',
      'Soviet-Afghan War (1979 - 1989)': 'The decade-long conflict in which the Soviet Union intervened to support the Afghan communist government against mujahideen rebels backed by the U.S., Pakistan, and Saudi Arabia.',
      'Soviet Invasion of Afghanistan (1979 - 1980)': 'The December 1979 Soviet military intervention in Afghanistan that escalated Cold War tensions and triggered an international boycott of the 1980 Moscow Olympics.',
      'Soviet Withdrawal from Afghanistan (1988 - 1989)': 'The Soviet military withdrawal that began May 15, 1988, completing in February 1989 — a humiliating defeat that contributed to the collapse of the USSR.',
      "Iran's Axis of Resistance (1979 - present)": 'The network of state and non-state allies Iran began building after the 1979 Islamic Revolution, including Hezbollah, Hamas, Palestinian Islamic Jihad, the Houthis, and Iraqi Shia militias, aimed at countering Israeli and U.S. influence.',
      'IRGC (1979)': 'The Islamic Revolutionary Guard Corps, founded after the 1979 revolution as an independent military force charged with defending the regime and advancing Iran\'s ideological goals abroad.',
      'Quds Force (1988)': 'The elite IRGC unit responsible for extraterritorial operations, intelligence, and support for proxy groups across the Middle East.',
      'Syrian Alliance (1979)': 'Iran\'s strategic alliance with the Assad regime in Syria, providing a vital land corridor for supplying Hezbollah in Lebanon.',
      'Hezbollah (1982)': 'A powerful Lebanese Shia political party and paramilitary group that emerged during Israel\'s 1982 invasion, growing into one of the region\'s most capable non-state military forces with Iranian backing.',
      'Palestinian Islamic Jihad (1987)': 'An Iranian-backed Palestinian militant organization that became one of Tehran\'s most loyal proxies in the "Axis of Resistance," focused on armed resistance against Israel.',
      'Hamas (1990)': 'The Palestinian Islamist organization that received initial Iranian financial, military, and media support in 1990, becoming a key but sometimes independent member of the Axis of Resistance.',
      'Houthi Movement (1992)': 'The Zaydi Shia Ansar Allah movement in Yemen that emerged as an Iranian-backed proxy, eventually seizing the capital Sanaa and triggering a Saudi-led military intervention.',
      'Iraqi Shia Militias (2003)': 'Various Iranian-backed armed groups in Iraq that emerged or strengthened after the 2003 U.S. invasion, playing complex roles in Iraq\'s security and politics.',
      'Badr Organization (1982)': 'Founded in Iran during the Iran-Iraq War as one of the oldest Iranian-backed Shia political and paramilitary organizations in Iraq.',
      'Asaib Ahl al-Haq (2006)': 'A powerful Iranian-backed Iraqi Shia militia and political party that split from the Mahdi Army, known for attacks against U.S. forces in Iraq and Syria.',
      'Kataib Hezbollah (2007)': 'A hardline Iranian-backed Iraqi Shia militia with strong ties to the Quds Force, designated a terrorist organization by the United States.',
      'Popular Mobilization Forces (2014)': 'An Iraqi state-sponsored umbrella of mostly Shia paramilitary groups, many Iranian-backed, formed in 2014 in response to the ISIS threat.',
      'Bahraini Proxy (1981)': 'Iran\'s backing of the 1981 coup attempt in Bahrain by the Islamic Front for the Liberation of Bahrain, and continued support for Shia opposition groups including during the 2011 Arab Spring uprising.',
      "Saudi Arabia's Sunni Network (1979 - present)": 'Saudi Arabia\'s strategic alliances and financial influence aimed at counterbalancing Iran\'s Axis of Resistance through support for Sunni political and paramilitary groups across the Middle East.',
      'Gulf Cooperation Council (1981)': 'A regional intergovernmental organization founded in 1981 comprising Saudi Arabia, UAE, Kuwait, Bahrain, Qatar, and Oman, serving as a platform for Gulf Sunni monarchies to coordinate against Iranian influence.',
      "Pakistan's Deobandi Network (1980 - present)": 'An expansive system of Pakistani madrasas and religious institutions that have profoundly shaped the country\'s political landscape and served as a source for various armed groups including the Taliban.',
      'Taliban (1994)': 'An Islamist fundamentalist movement that emerged in Pakistan\'s Deobandi madrasa network and seized control of Afghanistan, returning to power after the U.S. withdrawal in 2021.',
      'Iran-Iraq War (1980 - 1988)': 'The devastating eight-year conflict initiated by Iraq\'s 1980 invasion of Iran, stemming from historical grievances and the threat of the Islamic Revolution, ending in a bloody stalemate.',
      'Operation Opera (1981)': 'Israel\'s June 1981 air strike that destroyed Iraq\'s Osirak nuclear reactor near Baghdad, citing fears it would be used to produce nuclear weapons.',
      'Second Israeli Invasion of Lebanon (1982)': 'Israel\'s 1982 invasion of Lebanon aimed at expelling the PLO from Beirut, which led to a prolonged occupation and the rise of Hezbollah as a resistance movement.',
      'Second Sudanese Civil War (1983 - 2005)': 'A devastating resumption of conflict when Sudan\'s northern government imposed Islamic law, displacing millions and ultimately resulting in South Sudan\'s independence in 2011.',
      'South Lebanon Conflict (1985 - 2000)': 'An 18-year war of attrition between Israeli forces and Hezbollah in southern Lebanon, concluding with Israel\'s unilateral withdrawal in May 2000.',
      'Palestinian Intifadas (1987 - 2005)': 'Two major Palestinian uprisings against Israeli occupation — the largely civilian First Intifada (1987–1993) and the far more violent Second Intifada (2000–2005).',
      'First Intifada (1987 - 1993)': 'A largely spontaneous Palestinian uprising marked by protests, civil disobedience, and stone-throwing that eventually led to the Oslo Peace Accords.',
      'Second Intifada (2000 - 2005)': 'A far more violent Palestinian uprising marked by armed confrontations and suicide bombings, resulting in thousands of casualties on both sides.',
      'Non-State Extremist Groups (1988 - present)': 'A transnational constellation of Salafi-jihadist organizations sharing a radical ideology aiming to establish a global Islamic caliphate through armed struggle.',
      'Al-Qaeda (1988 - present)': 'The global jihadist network founded by Osama bin Laden, responsible for the September 11 attacks, and operating through affiliates across Africa, the Arabian Peninsula, and beyond.',
      'ISIS (2004 - present)': 'The Islamic State of Iraq and Syria — a Salafi-jihadist entity that declared a caliphate in 2014, was territorially defeated by 2017, but continues as a global insurgency.',
      'Hayat Tahrir al-Sham (2017 - present)': 'A Syrian Islamist organization that evolved from Al-Qaeda affiliates and led the 2024 offensive that overthrew Bashar al-Assad.',
      'First Gulf War (1990 - 1991)': 'The 1990–1991 international conflict triggered by Iraq\'s invasion of Kuwait, resolved by a U.S.-led coalition\'s military campaign that liberated Kuwait.',
      'Iraq Invades Kuwait (1990)': 'Iraq\'s August 2, 1990 invasion and annexation of Kuwait, triggering international condemnation and a U.S.-led military coalition.',
      'Operation Desert Storm (1991)': 'The 1991 combat phase of the Gulf War, featuring a massive aerial bombardment followed by a swift 100-hour ground offensive that liberated Kuwait.',
      'Somali Civil War (1991 - present)': 'An ongoing conflict that intensified with the 1991 overthrow of the Siad Barre regime, leading to state collapse, clan warfare, and the rise of Islamist insurgents.',
      'Oslo Accords (1993)': 'The September 13, 1993 agreement between Israel and the PLO establishing a framework for Palestinian interim self-government, opposed by Iran.',
      'Israel-Jordan Peace Treaty (1994)': 'The October 26, 1994 treaty that formally ended the state of war between Israel and Jordan, establishing diplomatic relations.',
      'Clean Break Report (1996)': 'A 1996 strategy memo presented to Netanyahu by U.S. neoconservatives Richard Perle, Douglas Feith, and David Wurmser advocating Israel abandon Oslo and reshape the Middle East by weakening Iraq and Syria.',
      "Turkey's Sunni Network (2002 - present)": 'Turkey\'s expanded regional influence under the AKP government, using diplomatic, economic, and military tools to support Sunni Muslim communities and project a neo-Ottoman foreign policy vision.',
      'U.S. War on Terror (2001 - 2021)': 'The global U.S.-led military and intelligence campaign launched after the September 11 attacks, encompassing the wars in Afghanistan and Iraq and counterterrorism operations worldwide.',
      '9/11 Attacks (2001)': 'The September 11, 2001 Al-Qaeda hijacking of four planes, crashing two into the World Trade Center, one into the Pentagon, and one in Pennsylvania, killing nearly 3,000 people.',
      'War in Afghanistan (2001 - 2021)': 'The U.S.-led war to dismantle Al-Qaeda and remove the Taliban government that harbored it, becoming the longest war in American history before ending with a Taliban takeover in 2021.',
      'U.S. Withdrawal from Afghanistan (2021)': 'The August 30, 2021 final withdrawal of U.S. troops from Afghanistan, enabling a rapid Taliban takeover and the collapse of the U.S.-backed government.',
      'Iraq War (2003 - 2011)': 'The U.S.-led invasion and occupation of Iraq launched in March 2003 under disputed WMD claims, resulting in the overthrow of Saddam Hussein and a prolonged insurgency.',
      'U.S. Invasion of Iraq (2003)': 'The March 20, 2003 U.S.-led invasion of Iraq that toppled Saddam Hussein\'s government within weeks.',
      'Execution of Saddam Hussein (2006)': 'Saddam Hussein was hanged on December 30, 2006 after being convicted by an Iraqi Special Tribunal for crimes against humanity.',
      'Iraqi Insurgency (2006 - present)': 'Sectarian violence that intensified in 2006 following the Golden Mosque bombing in Samarra, with Al-Qaeda in Iraq gaining prominence under Zarqawi.',
      'U.S. Withdrawal from Iraq (2011)': 'The 2011 withdrawal of U.S. combat forces from Iraq, formally ending the Iraq War.',
      'Libya Abandons WMDs (2003)': 'Libya\'s December 2003 announcement to dismantle its WMD programs — the model Israel\'s Netanyahu would later cite as the only acceptable outcome for Iran\'s nuclear program.',
      'War in Darfur (2003 - 2020)': 'The conflict in western Sudan involving government-backed Janjaweed militias and rebel groups, resulting in widespread atrocities and accusations of genocide against non-Arab ethnic groups.',
      'Second Lebanon War (2006)': 'The 34-day 2006 conflict sparked by Hezbollah\'s cross-border abduction of Israeli soldiers, resulting in significant damage to Lebanon and failing to decisively defeat Hezbollah.',
      'Arab Spring (2010 - 2012)': 'The wave of pro-democracy uprisings that swept the Arab world from 2010 to 2012, overthrowing governments in Tunisia, Egypt, Libya, and Yemen while sparking civil wars in Syria and Libya.',
      'Tunisian Revolution (2010 - 2011)': 'The Arab Spring\'s first revolution, ignited by Mohamed Bouazizi\'s December 2010 self-immolation and culminating in the overthrow of President Ben Ali.',
      'First Libyan Civil War (2011)': 'The NATO-backed 2011 uprising against Muammar Gaddafi that resulted in his overthrow and killing, followed by a prolonged period of instability.',
      'Syrian Civil War (2011 - present)': 'The multi-sided conflict beginning with 2011 pro-democracy protests against Assad, drawing in Iran, Russia, Turkey, the U.S., Israel, and various armed groups in a devastating humanitarian crisis.',
      'Fall of Assad (2024)': 'The December 8, 2024 overthrow of Bashar al-Assad by an offensive led by Hayat Tahrir al-Sham and the Turkish-backed Syrian National Army, ending over five decades of Assad family rule.',
      'Second Libyan Civil War (2014 - 2020)': 'A multi-sided civil war between competing governments and armed factions in Libya from 2014 to 2020, drawing in regional and international actors.',
      'Yemeni Civil War (2014 - present)': 'The ongoing conflict between the Houthi movement and the internationally recognized Yemeni government, drawing in a Saudi-led coalition and creating a severe humanitarian crisis.',
      'JCPOA (2015)': 'The 2015 Joint Comprehensive Plan of Action between Iran and world powers that significantly limited Iran\'s nuclear program in exchange for sanctions relief.',
      'JCPOA Withdrawal (2018)': 'The Trump administration\'s 2018 unilateral withdrawal from the Iran nuclear deal, reimposing sanctions and prompting Iran to scale back compliance.',
      'Assassination of Qassem Soleimani (2020)': 'The January 3, 2020 U.S. drone strike near Baghdad that killed IRGC Quds Force commander Qassem Soleimani, dramatically escalating U.S.-Iran tensions.',
      'Abraham Accords (2020)': 'The September 2020 normalization agreements establishing full diplomatic relations between Israel and the UAE, Bahrain, Sudan, and Morocco.',
      'Third Sudanese Civil War (2023 - present)': 'The ongoing conflict between the Sudanese Armed Forces and the Rapid Support Forces that began in April 2023, creating a massive humanitarian crisis.',
      'Gaza War (2023 - present)': 'The multi-front conflict ignited by Hamas\'s October 7, 2023 attack on Israel, encompassing Israeli military operations in Gaza, escalation with Hezbollah, Houthi attacks, and direct Iran-Israel exchanges.',
      'Hamas Attack on Israel (2023)': 'The October 7, 2023 surprise large-scale assault from Gaza resulting in over 1,200 Israeli deaths and approximately 250 abductions, triggering the largest Israeli military operation in decades.',
      'Israeli Ground Invasion of Gaza (2023)': 'Israel\'s full-scale ground invasion of Gaza beginning October 27, 2023, following initial airstrikes and a total blockade, aimed at destroying Hamas.',
      'Gaza Buffer Zone (2023 - present)': 'A demolished and militarized strip along the entire Gaza-Israel border created by Israeli forces to prevent future attacks, substantially reducing Gaza\'s accessible territory.',
      'Rafah Siege (2024)': 'Israel\'s May 2024 siege of Rafah in southern Gaza that eliminated Hamas\'s remaining military battalions.',
      'Haniyeh Assassination (2024)': 'Israel\'s July 31, 2024 assassination of Hamas leader Ismail Haniyeh in Tehran, hours after he attended the inauguration of Iran\'s new president.',
      'Israel-Hezbollah Conflict (2023 - present)': 'The escalating conflict beginning October 8, 2023 when Hezbollah began firing rockets in solidarity with Hamas, leading to major Israeli operations including the pager attacks and ground invasion of Lebanon.',
      'Pager and Walkie-Talkie Attacks (2024)': 'Israel\'s simultaneous detonation of thousands of Hezbollah pagers on September 17 and walkie-talkies on September 18, 2024, killing and wounding hundreds of operatives.',
      'Assassination of Hassan Nasrallah (2024)': 'Israel\'s September 27, 2024 strike on Beirut killing Hezbollah leader Hassan Nasrallah and IRGC General Abbas Nilforoushan.',
      'Israeli Invasion of Southern Lebanon (2024)': 'Israel\'s October 1, 2024 full-scale ground invasion of southern Lebanon targeting Hezbollah infrastructure.',
      'Israel-Houthi Conflict (2023 - present)': 'The conflict beginning October 2023 when Houthis launched missiles at Israel in solidarity with Palestinians and began attacking Red Sea shipping, drawing U.S.-led military responses.',
      'Houthi Red Sea Attacks (2023)': 'Beginning October 19, 2023, Houthi forces attacked commercial vessels and hijacked the Galaxy Leader in the Red Sea, disrupting global shipping lanes.',
      'Operation Poseidon Archer (2024)': 'The January 12, 2024 U.S.-UK-led airstrike campaign against Houthi targets in Yemen aimed at degrading their capability to attack Red Sea shipping.',
      'Operation Rough Rider (2025)': 'A U.S.-led military campaign of airstrikes against Houthi targets in Yemen from March 15 to May 6, 2025, concluding with a ceasefire announcement.',
      'Iran-Israel Escalation (2024)': 'The direct exchange of strikes between Iran and Israel in 2024, marking the first such direct confrontation between the two countries.',
      'Operation True Promise (2024)': 'Iran\'s April 13, 2024 retaliatory missile and drone attack on Israel for the Damascus airstrike, with most projectiles intercepted by Israel and its allies.',
      'Operation True Promise II (2024)': 'Iran\'s October 1, 2024 missile attack on Israel retaliating for the assassinations of Haniyeh and Nasrallah.',
      'Operation Days of Repentance (2024)': 'Israel\'s October 26, 2024 retaliatory strikes targeting Iranian missile production and air defense facilities.',
      'THAAD Deployment to Israel (2024)': 'The U.S. deployment of a Terminal High Altitude Area Defense system to Israel on October 13, 2024, to enhance missile defense amid escalating tensions.',
      'Operation Rising Lion (2025)': 'Israel\'s June 13, 2025 large-scale attack on Iran targeting nuclear facilities, military installations, and senior military and nuclear leadership.',
      // America (contemporary) summaries
      'America (1945 - present)': 'The United States\' postwar history as the world\'s leading superpower, shaped by Cold War competition, civil rights struggles, political scandals, and growing Israeli influence over American foreign policy.',
      "Israeli Influence over America (1945 - present)": 'The sustained and evolving influence of pro-Israel interests on U.S. foreign policy, from AIPAC\'s lobbying to the Trump administration\'s unprecedented alignment with Israeli strategic objectives.',
      "Trump's Second Term Pro-Israel Policies": 'The Trump administration\'s second-term approach characterized by nearly $12 billion in arms sales to Israel in its first six weeks, reduced foreign aid to all nations except Israel, and support for Israeli regional objectives including potential military action against Iran.',
      'Federal Crackdown on Campus Antisemitism (2023 - present)': 'The Trump administration\'s use of federal funding threats and visa revocations to suppress pro-Palestinian speech on U.S. university campuses, invoking Title VI of the Civil Rights Act.',
      'Columbia University Federal Pressure (2025)': 'The Trump administration cancelled $400 million in Columbia University grants in March 2025, forcing policy changes including curriculum reviews and protest restrictions after pro-Palestinian demonstrations.',
      'Harvard University Federal Pressure (2025)': 'The Trump administration threatened to revoke nearly $9 billion in Harvard\'s federal funding in 2025 over pro-Palestinian messaging deemed antisemitic.',
      'AIPAC and Pro-Israel Political Spending': 'AIPAC and the United Democracy Project spent over $100 million in the 2024 election opposing progressive candidates critical of Israel, representing the most significant pro-Israel electoral intervention in U.S. history.',
      'Brown v. Board of Education (1954)': 'The 1954 Supreme Court ruling that racial segregation in public schools was unconstitutional, overturning Plessy v. Ferguson and launching the civil rights era.',
      '1960 Presidential Election': 'The closely contested 1960 election in which Democrat John F. Kennedy defeated Republican Richard Nixon, with key Mob-connected support in Illinois and West Virginia.',
      'Civil Rights Act of 1964': 'The landmark July 2, 1964 legislation signed by President Johnson outlawing discrimination based on race, color, religion, sex, or national origin, including the Title VI prohibition on discrimination in federally funded programs.',
      'Kent State Shootings (1970)': 'The May 4, 1970 killing of four unarmed students by the Ohio National Guard during an anti-Vietnam War protest at Kent State University, sparking national outrage.',
      'Watergate (1972 - 1974)': 'The political scandal stemming from the June 1972 break-in at Democratic National Committee headquarters that exposed widespread corruption and led to President Nixon\'s resignation.',
      'Watergate Break-In (1972)': 'The June 17, 1972 break-in by operatives connected to Nixon\'s reelection campaign at the Watergate complex, triggering the scandal that brought down a presidency.',
      'Nixon Resignation (1974)': 'President Richard Nixon resigned on August 9, 1974, to avoid certain impeachment over his involvement in covering up the Watergate break-in.',
      'Roe v. Wade (1973)': 'The January 22, 1973 Supreme Court decision establishing a woman\'s constitutional right to an abortion under the Fourteenth Amendment, later overturned in 2022.',
      'U.S. Bicentennial (1976)': 'The nationwide 1976 celebration commemorating the 200th anniversary of the Declaration of Independence.',
      'Star Wars: A New Hope (1977)': 'George Lucas\'s 1977 science fiction film that revolutionized the genre, launched a massive franchise, and became a defining cultural landmark.',
      'AIDS Epidemic (1981 - present)': 'The HIV/AIDS epidemic recognized by the CDC in June 1981, initially devastating gay communities and eventually becoming a global pandemic requiring sustained public health response.',
      '1996 Presidential Election': 'Incumbent President Bill Clinton won re-election defeating Republican Bob Dole with 49.2% of the popular vote and 379 electoral votes.',
      '2000 Presidential Election': 'The disputed election between George W. Bush and Al Gore, ultimately decided by the Supreme Court after the contested Florida recount, giving Bush the presidency despite Gore winning the popular vote.',
      'Hurricane Katrina (2005)': 'The August 29, 2005 catastrophic hurricane that devastated the Gulf Coast and New Orleans, causing over 1,800 deaths and exposing severe failures in emergency response.',
      '2008 Presidential Election': 'Democrat Barack Obama defeated Republican John McCain, becoming the first African American president of the United States.',
      '2016 Presidential Election': 'Donald Trump defeated Hillary Clinton on November 8, 2016, winning 304 electoral votes despite losing the popular vote by approximately 2.8 million votes.',
      '2017 JFK File Declassification': 'President Trump authorized release of thousands of JFK assassination documents in accordance with the 1992 JFK Records Act, though some remained withheld.',
      'First Impeachment of Donald Trump (2019 - 2020)': 'The House impeached Trump on December 18, 2019 for abuse of power and obstruction of Congress related to Ukraine; the Senate acquitted him on February 5, 2020.',
      '2020 Presidential Election': 'Joe Biden defeated incumbent Donald Trump in a highly contentious election marked by record voter turnout, expanded mail-in voting, and numerous legal challenges.',
      'Attack on the U.S. Capitol (2021)': 'The January 6, 2021 violent storming of the U.S. Capitol by Trump supporters attempting to disrupt certification of the 2020 election results.',
      'Second Impeachment of Donald Trump (2021)': 'Trump was impeached by the House on January 13, 2021 for "incitement of insurrection" and acquitted by the Senate on February 13, 2021, making him the only president impeached twice.',
      'Buffalo Mass Shooting (2022)': 'A racially motivated shooting at a Buffalo, NY supermarket on May 14, 2022, killing ten people, primarily Black individuals.',
      'Trump Indictments (2023)': 'Donald Trump faced four separate criminal indictments in 2023: NY hush-money, federal classified documents, federal election interference, and Georgia election interference.',
      '2024 Presidential Election': 'Donald Trump defeated Kamala Harris on November 5, 2024, winning a non-consecutive second term, supported by a notable institutional shift including major corporate executives and Zionist donors.',
      'Assassination Attempt on Donald Trump (2024)': 'A July 13, 2024 assassination attempt at a Butler, Pennsylvania rally was thwarted when Secret Service snipers killed shooter Thomas Matthew Crooks, who wounded Trump\'s ear.',
      'Biden Withdrawal from Race (2024)': 'President Biden withdrew from the 2024 presidential race on July 21, 2024, primarily due to widespread concerns about his age and cognitive fitness amplified by a disastrous debate performance.',
      'Trump Defeats Kamala Harris (2024)': 'Donald Trump won the November 5, 2024 presidential election against Vice President Kamala Harris, securing a second non-consecutive term.',
      'Institutional Shift Toward Trump (2024)': 'The unprecedented attendance of major corporate executives (Musk, Zuckerberg, Bezos, Pichai, Cook) at Trump\'s inauguration and a surge in Zionist donor support signaled a significant institutional realignment.',
      '2025 JFK File Declassification': 'President Trump\'s executive order directed the release of over 63,000 of approximately 80,000 previously classified JFK assassination pages and the un-redaction of about 1,000 documents.',
      // Other contemporary
      'United Kingdom (1945 - present)': 'Britain\'s postwar history as a diminished but still significant world power, navigating decolonization, the Cold War, European integration, and Brexit.',
      'Queen Elizabeth II Ascends (1952)': 'Queen Elizabeth II acceded to the throne on February 6, 1952 following the death of her father King George VI, beginning a 70-year reign.',
      'India (1945 - present)': 'India\'s postwar history as an independent democracy navigating partition, Cold War non-alignment, economic development, and emergence as a major global power.',
      'Bhopal Gas Tragedy (1984)': 'The December 3, 1984 catastrophic gas leak at a Union Carbide pesticide plant in Bhopal, India, causing thousands of immediate deaths and long-term health damage to hundreds of thousands.',
      'Rwanda (1962 - present)': 'Rwanda\'s history from independence to the present, dominated by the devastating 1994 genocide and subsequent reconstruction.',
      'Rwandan Genocide (1994)': 'The April–July 1994 mass slaughter of an estimated 800,000 Tutsi by the Hutu majority in Rwanda, one of the most rapid genocides in history.',
      'Algerian War of Independence (1954 - 1962)': 'The violent struggle culminating in Algeria\'s liberation from French colonial rule, supported by Egypt\'s Nasser and publicly championed by U.S. Senator John F. Kennedy.',
      'Bangladesh Liberation War (1971)': 'The March–December 1971 conflict that resulted in Bangladesh\'s independence from Pakistan following a brutal military crackdown and Indian military intervention.',
      'Falklands War (1982)': 'The April–June 1982 ten-week conflict between Argentina and Britain over the Falkland Islands, resulting in a British victory and reaffirmation of British sovereignty.',
      'Post-Cold War Era (1991 - 2001)': 'The post-Soviet decade of U.S. unipolarity, globalization, humanitarian interventions, and emerging security threats that ended with the September 11 attacks.',
      'Yugoslav Wars (1991 - 2001)': 'A series of ethnic conflicts following Yugoslavia\'s dissolution, including wars in Croatia, Bosnia, Kosovo, and Macedonia, resulting in massive casualties and NATO\'s first European military intervention.',
      'Croatian War of Independence (1991 - 1995)': 'The armed conflict between Croatian forces seeking independence and Serbian-controlled Yugoslav forces, ending with Croatian territorial recovery.',
      'Bosnian War (1992 - 1995)': 'The devastating 1992–1995 war following Bosnia\'s independence declaration, marked by ethnic cleansing and the Srebrenica massacre, ending with the Dayton Accords.',
      'Kosovo War (1998 - 1999)': 'The 1998–1999 conflict between Kosovo Liberation Army forces and Serbian forces, resolved by NATO\'s 78-day air campaign against Yugoslavia.',
      'NATO Bombing of Yugoslavia (1999)': 'Operation Allied Force — NATO\'s March–June 1999 air campaign that halted Serbian ethnic cleansing in Kosovo and led to Serbian withdrawal and NATO peacekeeping.',
      'Macedonian Conflict (2001)': 'A brief 2001 armed insurgency by ethnic Albanian rebels seeking greater rights in Macedonia, resolved through a peace agreement.',
      'Late 1990s Global Financial Crises (1994 - 2002)': 'A series of interconnected emerging-market financial crises affecting Mexico, Southeast Asia, Russia, and Argentina, demonstrating the vulnerabilities of financial globalization.',
      'Mexican Peso Crisis (1994 - 1995)': 'The 1994–1995 Mexican financial crisis triggered by sudden peso devaluation, requiring a major U.S.-led bailout and affecting other emerging markets through the "Tequila Effect."',
      'Asian Financial Crisis (1997 - 1998)': 'The 1997–1998 financial collapse beginning with Thailand\'s baht devaluation that devastated Southeast Asian economies and spread globally.',
      'Russian Financial Crisis (1998)': 'The 1998 Russian economic collapse when the government devalued the ruble and defaulted on domestic debt, triggering widespread financial instability.',
      'Argentine Economic Crisis (1999 - 2002)': 'Argentina\'s severe 1999–2002 recession culminating in sovereign debt default and the collapse of the peso-dollar currency peg.',
      'Jeffrey Epstein Scandal (2005 - present)': 'The ongoing scandal surrounding financier Jeffrey Epstein\'s decades-long sexual trafficking of minors and his connections to powerful figures in politics, finance, and intelligence.',
      'Death of Jeffrey Epstein (2019)': 'Jeffrey Epstein was found dead in his New York jail cell on August 10, 2019, with his death ruled a suicide but widely questioned by the public.',
      'Global Financial Crisis (2008 - 2009)': 'The worst financial crisis since the Great Depression, triggered by the U.S. subprime mortgage collapse and resulting in a worldwide recession requiring massive government intervention.',
      'U.S. Subprime Mortgage Collapse (2007)': 'The 2007 collapse of the U.S. subprime mortgage market as rising defaults triggered the failure of major lenders and hedge funds, initiating the Global Financial Crisis.',
      'Lehman Brothers Bankruptcy (2008)': 'The September 15, 2008 bankruptcy of Lehman Brothers — the largest in U.S. history — that triggered a severe global financial meltdown.',
      'Russo-Ukrainian War (2014 - present)': 'Russia\'s ongoing military aggression against Ukraine beginning with the 2014 Crimea annexation and escalating to a full-scale invasion in February 2022.',
      'Russian Annexation of Crimea (2014)': 'Russia\'s March 2014 annexation of the Crimean Peninsula from Ukraine following a disputed referendum, violating international law.',
      'War in Donbas (2014 - 2022)': 'The 2014–2022 armed conflict in eastern Ukraine between Ukrainian forces and Russian-backed separatists in the Donetsk and Luhansk regions.',
      'Russian Invasion of Ukraine (2022 - present)': 'Russia\'s February 24, 2022 full-scale invasion of Ukraine, triggering the largest European military conflict since World War II.',
      'European Migrant Crisis (2015)': 'The 2015 mass influx of refugees and migrants into Europe primarily from Syria, Afghanistan, and Africa, creating major political, social, and humanitarian challenges.',
      'MeToo Movement (2017 - 2018)': 'The viral social movement sparked by Alyssa Milano\'s October 2017 tweet that amplified awareness of sexual harassment and assault, leading to numerous high-profile accountability cases.',
      'COVID-19 Pandemic (2019 - 2023)': 'The global pandemic caused by the SARS-CoV-2 coronavirus that originated in Wuhan, China in late 2019, killing millions worldwide and triggering unprecedented economic and social disruption.',
      // Legacy keys for renamed Cold War node
      'Cold War (1947 - 1991)': 'The geopolitical tension between the United States and Soviet Union without direct military conflict.',
      '21st Century (2001 - present)': 'The current century characterized by rapid technological change, global terrorism, and climate concerns.',
      // Legacy date-first keys (kept for backwards compatibility but no longer matched by current node labels)
      '3.3 million years ago - 3,200 BC Prehistory': 'The period of human history before the invention of writing, spanning from 3.3 million years ago to 3,200 BC.',
      '3.3 million years ago - 3,300 BC Stone Age': 'The prehistoric period when stone tools were predominantly used, spanning from 3.3 million years ago to 3,300 BC.',
      '3,300 BC - 1,200 BC Bronze Age': 'The period characterized by the use of bronze tools and weapons, from 3,300 BC to 1,200 BC.',
      '1,200 BC - 600 BC Iron Age': 'The period characterized by the widespread use of iron tools and weapons, from 1,200 BC to 600 BC.',
      '3,200 BC - 476 AD Ancient History': 'The era of the earliest civilizations, from the invention of writing (3,200 BC) to the fall of the Western Roman Empire (476 AD).',
      '3,100 BC - 30 BC Ancient Egypt': 'The civilization along the Nile River known for pyramids, pharaohs, and hieroglyphic writing, from 3,100 BC to 30 BC.',
      '3,500 BC - 539 BC Ancient Mesopotamia': 'The region between the Tigris and Euphrates rivers, cradle of civilization with Sumerians, Babylonians, and Assyrians, from 3,500 BC to 539 BC.',
      '3,300 BC - 600 AD Ancient India': 'The early civilizations of the Indian subcontinent including the Indus Valley and Vedic periods, from 3,300 BC to 600 AD.',
      '2,070 BC - 220 AD Ancient China': 'Early Chinese civilization including the Shang, Zhou, Qin, and Han dynasties, from 2,070 BC to 220 AD.',
      '800 BC - 146 BC Ancient Greece': 'The civilization that developed philosophy, democracy, and classical art, from 800 BC to 146 BC.',
      '753 BC - 476 AD Ancient Rome': 'The civilization that grew from a city-state to an empire dominating the Mediterranean world, from 753 BC to 476 AD.',
      'Bronze Age (3,200 BC - 1,200 BC)': 'The period of ancient history spanning 3,200 BC to 1,200 BC, characterized by the widespread use of bronze tools and weapons, during which major civilizations flourished across the Near East, Aegean, and Egypt.',
      'Early Bronze Age (3,200 BC - 2,000 BC)': 'The earliest phase of the Bronze Age, which saw the widespread adoption of bronze, the rise of the first complex urban societies, and the development of early writing systems.',
      'Middle Bronze Age (2,000 BC - 1,600 BC)': 'A period of significant consolidation and expansion for urban civilizations, marked by increased urbanization, the strengthening of trade networks across vast distances, and the flourishing of prominent cultures such as the Minoan civilization on Crete and the early Mycenaean civilization on the Greek mainland.',
      'Late Bronze Age (1,600 BC - 1,200 BC)': 'A period of intense international relations and widespread prosperity among powerful empires across the Near East, Aegean, and Egypt, characterized by extensive long-distance trade and diplomatic exchanges, which abruptly ended with the Bronze Age Collapse.',
      'Helladic Civilization (3,200 BC - 2,000 BC)': 'The Early Bronze Age culture of mainland Greece (modern-day Aegea), characterized by the emergence of fortified settlements, increasing social complexity, and the beginnings of metallurgy, laying the groundwork for the later Mycenaean civilization.',
      'Ancient Egyptian Civilization (3,100 BC - 2,000 BC)': 'The Early Bronze Age phase of Egyptian civilization, defined by the unification of Upper and Lower Egypt under pharaonic rule, the development of hieroglyphic writing, the establishment of a highly centralized state, and the construction of monumental structures like the Great Pyramids.',
      'Minoan Civilization (3,100 BC - 2,000 BC)': 'The Early Bronze Age phase of Crete\'s civilization, establishing the foundational elements of Europe\'s first major civilization, marked by the development of diverse regional communities, early metallurgy, and nascent maritime trade networks.',
      'Norte Chico Civilization (3,000 BC - 2,000 BC)': 'The earliest known civilization in the Americas (modern-day Peru), distinguished by its monumental stepped pyramids, large urban centers like Caral, and complex societal organization, all developed independently without evidence of writing.',
      'Mari Civilization (2,900 BC - 2,000 BC)': 'A powerful and strategically important city-state in Mesopotamia (modern-day eastern Syria) that controlled vital trade routes connecting Mesopotamia with the Levant and Anatolia.',
      'Elamite Civilization (2,700 BC - 539 BC)': 'A powerful state in modern-day Iran with its own distinct culture, urban centers like Susa and Anshan, and an independent writing system, frequently engaging in both conflict and trade with its Mesopotamian neighbors.',
      'Xia Dynasty (2,070 BC - 2,000 BC)': 'The earliest legendary period of Chinese centralized state formation, representing the beginnings of Bronze Age culture in China that set the stage for later Chinese civilizations.',
      'Iron Age (1,200 BC - 600 BC)': 'The period following the Bronze Age spanning 1,200 BC to 600 BC, characterized by the widespread adoption of iron tools and weapons across the Middle East, Europe, and beyond.',
      'Early Iron Age (1,200 BC - 1,000 BC)': 'The initial phase of the Iron Age, marking a significant shift as iron increasingly replaced bronze for tools and weapons, spreading rapidly across the Middle East and into parts of Europe in the wake of the Bronze Age Collapse.',
      'Bronze Age Collapse (1,200 BC - 1,150 BC)': 'A period of widespread societal upheaval that saw the decline or destruction of major civilizations across the Eastern Mediterranean, Near East, and parts of Europe, attributed to a complex interplay of invasions, climate change, and systemic vulnerabilities.',
      'Middle Iron Age (1,000 BC - 800 BC)': 'The middle phase of the Iron Age, witnessing the increasing establishment and widespread adoption of iron technology, driving significant societal and political changes, including the emergence of powerful entities like the Assyrian Empire.',
      'Late Iron Age (800 BC - 600 BC)': 'The final phase of the Iron Age, during which iron technology became increasingly widespread and sophisticated, driving significant societal transformations including population growth, the rise of powerful states like the Neo-Assyrian Empire, and the development of more complex fortified settlements.',
      'Classical Antiquity (800 BC - 500 AD)': 'The period encompassing the flourishing civilizations of ancient Greece and Rome, characterized by major advances in art, philosophy, science, and governance that laid the foundations of Western civilization.',
      'Late Antiquity (250 - 500 AD)': 'The transitional phase within Ancient History marked by the gradual decline of the Western Roman Empire and the foundational changes leading to the Middle Ages.',
      'Migration Period (300 - 500 AD)': 'Characterized by significant movements of various peoples, primarily Germanic tribes, leading to widespread upheaval, the decline of the Western Roman Empire, and the emergence of new political entities across Europe.',
      '476 - 1453 Medieval Period': 'The historical period spanning from 476 to 1453, characterized by feudalism, the dominance of the Church in Europe, and ending with the fall of Constantinople.',
      '476 - 1000 Early Middle Ages': 'The period following the fall of Rome marked by the rise of Christianity and formation of new kingdoms, from 476 to 1000.',
      '1000 - 1250 High Middle Ages': 'The period of population growth, urbanization, and cultural flourishing including Gothic architecture and scholasticism, from 1000 to 1250.',
      '1250 - 1453 Late Middle Ages': 'The period marked by plague, war, and social upheaval leading to the end of the medieval era, from 1250 to 1453.',
      '330 - 1453 Byzantine Empire': 'The continuation of the Eastern Roman Empire preserving classical knowledge and Christian Orthodoxy, from 330 to 1453.',
      '750 - 1258 Islamic Golden Age': 'The period of scientific, cultural, and economic flourishing in the Islamic world, from 750 to 1258.',
      'Late Antiquity (500 - 750)': 'A transitional era within the Early Middle Ages characterized by the continued decline of Roman structures, the establishment of barbarian kingdoms, and the emergence of early Christian and Islamic societies.',
      'Migration Period (500 - 750)': 'Significantly shaped post-Roman Europe through the consolidation and development of Germanic kingdoms during the late antique period.',
      'Migration Period (750 - 800)': 'Reflects the consolidation of previously established Germanic kingdoms and the foundational developments leading to the Carolingian Empire.',
      'Carolingian Era (800 - 887)': 'A pivotal period in early medieval European history marked by the unified rule of the Carolingian Empire under Charlemagne and his successors, fostering a significant cultural and intellectual revival known as the Carolingian Renaissance.',
      'Post-Carolingian Era (887 - 1000)': 'A turbulent period characterized by the fragmentation of the Carolingian Empire, the rise of powerful regional lords, and intensified external invasions by Vikings, Magyars, and Saracens, leading to significant political and social reorganization across Western Europe.',
      'Early High Middle Ages (1000 - 1100)': 'A dynamic period marked by significant population growth, agricultural and technological innovations, the expansion of trade, the rise of towns and cities, the Great Schism of 1054, and the beginning of the Crusades.',
      'Central High Middle Ages (1100 - 1200)': 'A period of significant growth and change in Europe, characterized by the flowering of the 12th-century Renaissance in arts and learning, the continued expansion of trade and urbanization, the establishment of the first universities, and the ongoing impact of the Crusades.',
      'Late High Middle Ages (1201 - 1300)': 'Represents the peak of medieval civilization in Europe, characterized by the flourishing of Gothic architecture, the continued growth of universities and scholastic thought, and the strengthening of national monarchies, though it also saw the seeds of future crises like the Great Famine and the Black Death.',
      'Late Middle Ages (1250 - 1453)': 'A tumultuous period marked by significant challenges such as the Black Death, the Hundred Years\' War, and the Western Schism, yet it also laid the groundwork for the Renaissance and the Age of Exploration.',
      '1453 - present Modern Era': 'The period from 1453 to the present, marked by the transition from medieval to contemporary society.',
      '1453 - 1789 Early Modern Period': 'A period of significant cultural, intellectual, and political transformation from 1453 to 1789, including the Renaissance, Reformation, and Enlightenment.',
      '1300 - 1600 Renaissance': 'The cultural rebirth in Europe marked by renewed interest in classical learning, art, and humanism, from 1300 to 1600.',
      '1400 - 1800 Age of Discovery': 'The period of European exploration and colonization of the Americas, Africa, and Asia, from 1400 to 1800.',
      '1517 - 1648 Reformation': 'The religious movement that split Western Christianity and led to the Protestant churches, from 1517 to 1648.',
      '1637 - 1800 Enlightenment': 'The intellectual movement emphasizing reason, science, and individual rights, from 1637 to 1800.',
      '1543 - 1687 Scientific Revolution': 'The period of major advances in science that laid the foundation of modern science, from 1543 to 1687.',
      'Global Exploration (1500 - 1560)': 'A transformative era characterized by extensive voyages of discovery, the mapping of new territories, and the establishment of initial colonial and trade networks across the world.',
      'Religious Transformation (1560 - 1648)': 'A tumultuous era marked by the Protestant Reformation, Catholic Counter-Reformation, and widespread religious conflicts that fundamentally reshaped European society and politics.',
      'Age of Absolutism (1648 - 1715)': 'A period in European history defined by the dominance of centralized, powerful monarchies asserting unquestioned authority over their realms.',
      'Industrial Age (1760 - 1800)': 'Marks the initial phase of profound technological innovation and societal transformation driven by the first Industrial Revolution.',
      '1789 - 1945 Late Modern Period': 'The period from 1789 to 1945, marked by industrialization, imperialism, world wars, and major social upheaval.',
      '1760 - 1840 Industrial Revolution': 'The transformation from agrarian to industrial society through mechanization and technological innovation, from 1760 to 1840.',
      '1774 - 1849 Age of Revolutions': 'The period of political upheaval with revolutions in America, France, and Latin America, from 1774 to 1849.',
      '1800 - 1945 Imperialism': 'The expansion of European powers through colonization and control of territories worldwide, from 1800 to 1945.',
      '1914 - 1918 World War I': 'The global conflict involving major world powers, from 1914 to 1918.',
      '1918 - 1939 Interwar Period': 'The period between the world wars marked by economic depression and the rise of totalitarianism, from 1918 to 1939.',
      '1939 - 1945 World War II': 'The global conflict between Allied and Axis powers, the deadliest war in history, from 1939 to 1945.',
      '1945 - present Contemporary Period': 'The period from 1945 to the present, shaped by decolonization, the Cold War, technological advancement, and globalization.',
      '1947 - 1991 Cold War': 'The geopolitical tension between the United States and Soviet Union without direct military conflict, from 1947 to 1991.',
      '1991 - 2001 Post-Cold War Era': 'The period following the Cold War marked by globalization and the spread of democracy, from 1991 to 2001.',
      '2001 - present 21st Century': 'The current century characterized by rapid technological change, terrorism, and climate concerns, from 2001 to present.',
      // Prehistoric Timeline Details
      '3.3 million years ago - 10,000 BC Paleolithic Era': 'The Old Stone Age when early humans used stone tools and lived as hunter-gatherers, from 3.3 million years ago to 10,000 BC.',
      '3.3 million years ago - 300,000 years ago Lower Paleolithic': 'The earliest phase of the Stone Age marked by the first stone tools and early human ancestors, from 3.3 million years ago to 300,000 years ago.',
      '300,000 years ago - 40,000 years ago Middle Paleolithic': 'The Stone Age period associated with Neanderthals and early Homo sapiens, featuring more sophisticated tools, from 300,000 to 40,000 years ago.',
      '300,000 years ago - 120,000 years ago Early Middle Paleolithic': 'The initial phase of the Middle Paleolithic with developing tool technologies and early human migration, from 300,000 to 120,000 years ago.',
      '120,000 years ago - 40,000 years ago Last Glacial Period (Middle Paleolithic)': 'The Ice Age during the Middle Paleolithic when much of the northern hemisphere was covered by glaciers, from 120,000 to 40,000 years ago.',
      '40,000 years ago - 10,000 BC Upper Paleolithic': 'The Late Stone Age period marked by modern human expansion, cave art, and advanced tools, from 40,000 years ago to 10,000 BC.',
      '40,000 years ago - 10,000 BC Last Glacial Period (Upper Paleolithic)': 'The final phase of the Ice Age during which modern humans spread across continents and developed sophisticated cultures, from 40,000 years ago to 10,000 BC.',
      '10,875 BC - 10,000 BC Younger Dryas Event (Upper Paleolithic)': 'A dramatic cold snap interrupting the warming trend at the end of the Ice Age, from 10,875 BC to 10,000 BC.',
      '10,000 BC - 8,000 BC Mesolithic Era': 'The Middle Stone Age transitional period between Paleolithic hunter-gatherers and Neolithic farmers, from 10,000 BC to 8,000 BC.',
      '10,000 BC - 9,675 BC Last Glacial Period End (Mesolithic)': 'The final phase of the Ice Age as glaciers retreated and climate warmed, from 10,000 BC to 9,675 BC.',
      '10,000 BC - 9,675 BC Younger Dryas Event (Mesolithic)': 'The continuation of the Younger Dryas cold period into the Mesolithic era, ending around 9,675 BC.',
      '9,675 BC - 9,575 BC Younger Dryas End (Late Mesolithic)': 'The conclusion of the Younger Dryas cold event, marking rapid climate warming, from 9,675 BC to 9,575 BC.',
      '9,675 BC - 8,000 BC Late Mesolithic': 'The final phase of the Middle Stone Age with warming climate and development of more complex hunter-gatherer societies, from 9,675 BC to 8,000 BC.',
      '8,000 BC - 4,500 BC Neolithic Era': 'The New Stone Age characterized by the development of agriculture, domestication of animals, and permanent settlements, from 8,000 BC to 4,500 BC.',
      '4,500 BC - 3,300 BC Copper Age': 'The Chalcolithic period when copper tools began to supplement stone implements, marking the transition to metal working, from 4,500 BC to 3,300 BC.',
      '4,100 BC - 3,300 BC Sumerian Civilization (Copper Age)': 'The early Sumerian culture in Mesopotamia developing irrigation, writing, and urban centers, from 4,100 BC to 3,300 BC.',
      '4,100 BC - 3,300 BC Uruk Period': 'The phase of Sumerian civilization centered on the city of Uruk, featuring the earliest known writing and monumental architecture, from 4,100 BC to 3,300 BC.',
      '4,100 BC - 3,300 BC Predynastic Egypt (Copper Age)': 'The period of Egyptian civilization before the unification under pharaonic rule, developing agriculture and settlements along the Nile, from 4,100 BC to 3,300 BC.',
      '3,500 BC - 3,300 BC Ebla Civilization (Copper Age)': 'The ancient Syrian city-state that flourished as a trade center in the Copper Age, from 3,500 BC to 3,300 BC.',
      '3,300 BC - 3,200 BC Early Bronze Age (Prehistoric)': 'The brief transitional period at the beginning of the Bronze Age before the development of writing systems, from 3,300 BC to 3,200 BC.',
      '3,300 BC - 3,200 BC Indus Valley Civilization (Prehistoric)': 'The earliest phase of the Harappan civilization in South Asia featuring planned cities and trade networks, from 3,300 BC to 3,200 BC.',
      '3,300 BC - 3,200 BC Cycladic Civilization (Prehistoric)': 'The early Bronze Age culture of the Cycladic islands in the Aegean Sea known for distinctive marble figurines, from 3,300 BC to 3,200 BC.',
      '3,200 BC - 1,200 BC Bronze Age (Ancient)': 'The historical period characterized by bronze metallurgy, the rise of civilizations, and the invention of writing, from 3,200 BC to 1,200 BC.',
      'Literature': 'Written works considered to have artistic or intellectual value, including fiction, poetry, and drama.',
      'Fiction': 'Imaginative narrative works including novels, short stories, and various genres.',
      'Novels': 'Extended works of prose fiction exploring characters, themes, and narratives.',
      'Victorian Novel': 'Novels from the Victorian era known for social commentary and moral themes.',
      'Modern Novel': 'Novels from the early 20th century characterized by experimental techniques and psychological depth.',
      'Postmodern Novel': 'Novels that challenge traditional narrative structures and question objective reality.',
      'Contemporary Novel': 'Current novels reflecting present-day themes, styles, and concerns.',
      'Experimental Fiction': 'Fiction that challenges conventional narrative forms and literary techniques.',
      'Realism': 'Literary movement depicting life accurately and objectively without idealization.',
      'Short Stories': 'Brief prose narratives focusing on a single incident or character.',
      'Science Fiction': 'Fiction exploring imaginative concepts often involving futuristic science and technology.',
      'Fantasy': 'Fiction featuring magical or supernatural elements in invented worlds.',
      'Historical Fiction': 'Fiction set in the past that blends historical facts with imaginative narratives.',
      'Literary Fiction': 'Fiction emphasizing literary merit, style, and thematic depth over commercial appeal.',
      'Poetry': 'Literary work using rhythm, imagery, and concentrated language to evoke emotion and meaning.',
      'Ancient Poetry': 'Poetry from ancient civilizations including epics, lyrics, and religious verse.',
      'Medieval Poetry': 'Poetry from the Middle Ages including courtly love, chivalric romance, and religious themes.',
      'Renaissance Poetry': 'Poetry from the Renaissance featuring humanism, classical influences, and sonnet forms.',
      'Romantic Poetry': 'Poetry emphasizing emotion, nature, imagination, and individual experience.',
      'Modern Poetry': 'Poetry from the early 20th century featuring free verse and experimental forms.',
      'Contemporary Poetry': 'Current poetry reflecting diverse voices, styles, and contemporary themes.',
      'Drama': 'Literature intended for theatrical performance exploring human conflicts and experiences.',
      'Comedy': 'Dramatic works using humor, wit, and happy endings to entertain and critique society.',
      'Tragedy': 'Dramatic works depicting the downfall of a protagonist through fatal flaws or circumstances.',
      'Tragicomedy': 'Dramatic works blending tragic and comic elements.',
      'Experimental Theatre': 'Drama that challenges conventional theatrical forms and audience expectations.',
      'Classical Drama': 'Drama from ancient Greece and Rome establishing foundational theatrical forms.',
      'Modern Drama': 'Drama from the late 19th and 20th centuries exploring psychological realism and social issues.',
      'Literary Theory': 'Critical frameworks for analyzing and interpreting literature.',
      'Structuralism': 'The theory that analyzes cultural phenomena through underlying structures and systems.',
      'Deconstruction': 'The critical approach questioning fixed meanings and revealing tensions in texts.',
      'Phenomenology': 'The philosophical approach examining consciousness and lived experience.',
      'Rhetoric': 'The art of persuasive speaking and writing using language effectively.',
      'Semiotics': 'The study of signs, symbols, and how meaning is created and communicated.',
      'Narratology': 'The study of narrative structure, techniques, and storytelling conventions.',
      'World Literature': 'Literary works from diverse cultures and languages across the globe.',
      'Classics': 'Ancient Greek and Roman literature of enduring influence and quality.',
      'Art': 'The expression or application of human creativity and imagination, producing works appreciated for their beauty or emotional power.',
      'Painting': 'The art of applying pigments to surfaces to create visual images.',
      'Renaissance Painting': 'Painting from the Renaissance featuring perspective, realism, and humanistic themes.',
      'Baroque Painting': 'Dramatic painting from the 17th century emphasizing movement, contrast, and emotional intensity.',
      'Impressionism': 'Late 19th century painting capturing light, color, and momentary impressions.',
      'Modernism': 'Early 20th century art movement breaking from traditional forms and embracing abstraction.',
      'Abstract Art': 'Art that uses shapes, colors, and forms rather than realistic representation.',
      'Contemporary Painting': 'Current painting reflecting diverse styles, media, and conceptual approaches.',
      'Sculpture': 'Three-dimensional art created by shaping materials such as stone, metal, or clay.',
      'Classical Sculpture': 'Sculpture from ancient Greece and Rome emphasizing idealized human forms.',
      'Renaissance Sculpture': 'Sculpture reviving classical techniques with heightened naturalism and emotion.',
      'Modern Sculpture': 'Sculpture from the 20th century exploring abstraction and new materials.',
      'Public Sculpture': 'Sculpture designed for display in public spaces and community engagement.',
      'Installation Sculpture': 'Large-scale sculptures transforming entire spaces into immersive environments.',
      'Performance Art': 'Art in which the artist\'s actions or presence constitute the work.',
      'Architecture': 'The art and science of designing and constructing buildings and structures.',
      'Classical Architecture': 'Architecture from ancient Greece and Rome emphasizing columns, symmetry, and proportion.',
      'Medieval Architecture': 'Architecture from the Middle Ages including Romanesque and Gothic styles.',
      'Renaissance Architecture': 'Architecture reviving classical principles with refined proportions and harmony.',
      'Modern Architecture': 'Architecture from the 20th century emphasizing function, simplicity, and new materials.',
      'Postmodern Architecture': 'Architecture challenging modernist principles with eclecticism and ornamentation.',
      'Contemporary Architecture': 'Current architecture using advanced technology and sustainable design.',
      'Photography': 'The art of creating images using light-sensitive materials or digital sensors.',
      'Installation Art': 'Art created for specific spaces, often immersive and multimedia.',
      'Digital Art': 'Art created using digital technology and computer software.',
      'Music': 'The art of arranging sounds in time to produce a composition through melody, harmony, rhythm, and timbre.',
      'Classical Music': 'Western art music from various historical periods emphasizing formal composition.',
      'Baroque': 'Music from 1600-1750 characterized by ornate melodies and figured bass.',
      'Classical Period': 'Music from 1750-1820 emphasizing clarity, balance, and formal structure.',
      'Romantic': 'Music from the 19th century emphasizing emotion, expression, and individualism.',
      'Modern Classical': 'Classical music from the early 20th century featuring new harmonies and atonality.',
      'Contemporary Classical': 'Current classical music exploring diverse styles and experimental techniques.',
      'Opera': 'Dramatic theatrical work combining music, singing, and staging.',
      'Jazz': 'American music genre featuring improvisation, syncopation, and swing rhythms.',
      'Early Jazz': 'Jazz from New Orleans and Chicago in the early 20th century.',
      'Swing': 'Jazz style from the 1930s-1940s featuring big bands and danceable rhythms.',
      'Bebop': 'Complex jazz style from the 1940s emphasizing fast tempos and improvisation.',
      'Cool Jazz': 'Relaxed jazz style from the 1950s featuring softer tones and more formal arrangements.',
      'Free Jazz': 'Experimental jazz from the 1960s breaking from conventional structures.',
      'Fusion': 'Jazz blending elements of rock, funk, and world music.',
      'Rock': 'Popular music genre characterized by electric guitars, drums, and strong rhythms.',
      'Pop': 'Popular music emphasizing catchy melodies and broad commercial appeal.',
      'World Music': 'Traditional and popular music from non-Western cultures.',
      'Electronic Music': 'Music produced using electronic instruments and digital technology.',
      'Languages': 'Systems of communication using symbols, sounds, or gestures, fundamental to human interaction and culture.',
      'Indo-European Languages': 'The largest language family including English, Spanish, Hindi, and Russian.',
      'Sino-Tibetan Languages': 'Language family including Chinese, Tibetan, and Burmese languages.',
      'Afro-Asiatic Languages': 'Language family including Arabic, Hebrew, and various African languages.',
      'Grammar': 'The system of rules governing the structure and use of language.',
      'Linguistics': 'The scientific study of language structure, development, and use.',
      'Translation': 'The process of converting text or speech from one language to another.',
      'Physics': 'The science of matter, energy, and the fundamental forces of nature, seeking to understand the universe\'s behavior.',
      'Mechanics': 'The branch of physics dealing with motion and forces acting on objects.',
      'Classical Mechanics': 'The study of motion of macroscopic objects based on Newton\'s laws.',
      'Kinematics': 'The description of motion without considering its causes.',
      'Dynamics': 'The study of forces and their effects on motion.',
      'Statics': 'The study of forces in equilibrium and bodies at rest.',
      'Fluid Dynamics': 'The study of the motion of liquids and gases.',
      'Wave Motion': 'The propagation of disturbances through a medium.',
      'Thermodynamics': 'The study of heat, energy, and their transformations.',
      'First Law': 'The law of conservation of energy stating energy cannot be created or destroyed.',
      'Second Law': 'The law stating that entropy in an isolated system always increases.',
      'Entropy': 'A measure of disorder or randomness in a system.',
      'Heat Transfer': 'The movement of thermal energy from one object or system to another.',
      'Phase Transitions': 'The transformation of matter between solid, liquid, gas, and plasma states.',
      'Cryogenics': 'The study of materials and phenomena at very low temperatures.',
      'Electromagnetism': 'The study of electric and magnetic fields and their interactions.',
      'Electric Fields': 'Regions of space where electric charges experience forces.',
      'Magnetic Fields': 'Regions of space where magnetic materials experience forces.',
      'Maxwell Equations': 'The four fundamental equations describing all electromagnetic phenomena.',
      'Light': 'Electromagnetic radiation visible to the human eye.',
      'Radiation': 'The emission or transmission of energy through space or matter.',
      'Plasma': 'The fourth state of matter consisting of ionized gas.',
      'Optics': 'The study of light and its interactions with matter.',
      'Geometric Optics': 'The study of light as rays traveling in straight lines.',
      'Wave Optics': 'The study of light as waves exhibiting interference and diffraction.',
      'Quantum Optics': 'The study of light-matter interactions at the quantum level.',
      'Photonics': 'The science and technology of generating, controlling, and detecting photons.',
      'Lasers': 'Devices that emit coherent, monochromatic light through stimulated emission.',
      'Color': 'The perception of different wavelengths of visible light.',
      'Quantum Physics': 'The study of matter and energy at atomic and subatomic scales.',
      'Wave-Particle Duality': 'The concept that particles can exhibit both wave and particle properties.',
      'Superposition': 'The quantum principle that systems can exist in multiple states simultaneously.',
      'Entanglement': 'The quantum phenomenon where particles remain correlated regardless of distance.',
      'Uncertainty Principle': 'Heisenberg\'s principle stating that certain pairs of properties cannot be simultaneously measured with precision.',
      'Quantum Computing': 'Computing using quantum phenomena like superposition and entanglement.',
      'Quantum Field Theory': 'The theoretical framework combining quantum mechanics and special relativity.',
      'Relativity': 'Einstein\'s theories describing space, time, and gravity.',
      'Special Relativity': 'The theory describing physics for objects moving at constant high speeds.',
      'General Relativity': 'Einstein\'s theory of gravitation describing gravity as curved spacetime.',
      'Spacetime': 'The four-dimensional continuum combining space and time.',
      'Gravity': 'The fundamental force attracting objects with mass toward each other.',
      'Cosmological Constant': 'A term in Einstein\'s equations representing dark energy or vacuum energy.',
      'Chemistry': 'The science of substances, their properties, reactions, and the changes they undergo.',
      'Organic Chemistry': 'The study of the structure, properties, composition, reactions, and synthesis of carbon-containing compounds.',
      'Hydrocarbons': 'Organic compounds consisting entirely of hydrogen and carbon.',
      'Functional Groups': 'Specific groups of atoms that determine the chemical properties of organic molecules.',
      'Reactions': 'Chemical processes in which substances are transformed into different compounds.',
      'Synthesis': 'The process of combining simpler compounds to form more complex molecules.',
      'Natural Products': 'Chemical compounds produced by living organisms.',
      'Polymers': 'Large molecules composed of repeating structural units.',
      'Inorganic Chemistry': 'The study of inorganic compounds, typically those that do not contain carbon-hydrogen bonds.',
      'Main Group Chemistry': 'The chemistry of elements in groups 1, 2, and 13-18 of the periodic table.',
      'Transition Metals': 'Elements in groups 3-12 of the periodic table with characteristic properties.',
      'Coordination Chemistry': 'The study of complexes formed between metal ions and ligands.',
      'Solid State Chemistry': 'The study of the structure, properties, and synthesis of solid materials.',
      'Crystal Chemistry': 'The study of the relationship between chemical composition and crystal structure.',
      'Geochemistry': 'The study of the chemical composition and processes of the Earth.',
      'Physical Chemistry': 'The branch of chemistry dealing with the physical properties and behavior of chemical systems.',
      'Kinetics': 'The study of the rates of chemical reactions and the factors affecting them.',
      'Quantum Chemistry': 'The application of quantum mechanics to chemical problems.',
      'Spectroscopy': 'The study of the interaction between matter and electromagnetic radiation.',
      'Electrochemistry': 'The study of chemical reactions involving electron transfer.',
      'Surface Chemistry': 'The study of chemical processes occurring at interfaces.',
      'Biochemistry': 'The study of the chemical processes and substances that occur within living organisms.',
      'Proteins': 'Large biomolecules consisting of amino acid chains performing diverse biological functions.',
      'Carbohydrates': 'Organic compounds consisting of carbon, hydrogen, and oxygen, serving as energy sources.',
      'Lipids': 'Hydrophobic or amphipathic molecules including fats, oils, and steroids.',
      'Nucleic Acids': 'Biomolecules including DNA and RNA that store and transmit genetic information.',
      'Enzymes': 'Biological catalysts that accelerate chemical reactions in living organisms.',
      'Metabolism': 'The chemical processes that occur within organisms to maintain life.',
      'Analytical Chemistry': 'The science of obtaining, processing, and communicating information about the composition and structure of matter.',
      'Materials Science': 'The study of the properties, performance, and applications of materials of all types.',
      'Biology': 'The scientific study of life and living organisms, encompassing their structure, function, growth, origin, evolution, and distribution.',
      'Botany': 'The scientific study of plants, including their physiology, structure, genetics, ecology, distribution, and classification.',
      'Plant Structure': 'The anatomical organization of plants including roots, stems, leaves, and tissues.',
      'Plant Physiology': 'The study of the functions and processes of plants.',
      'Plant Reproduction': 'The processes by which plants produce offspring through sexual and asexual means.',
      'Plant Ecology': 'The study of relationships between plants and their environment.',
      'Agricultural Botany': 'The application of botanical knowledge to crop production and farming.',
      'Ethnobotany': 'The study of relationships between people and plants, including traditional uses.',
      'Zoology': 'The scientific study of animals, including their biology, physiology, behavior, and evolution.',
      'Vertebrate Zoology': 'The study of animals with backbones including fish, amphibians, reptiles, birds, and mammals.',
      'Invertebrate Zoology': 'The study of animals without backbones including insects, mollusks, and worms.',
      'Animal Behavior': 'The study of how animals interact with each other and their environment.',
      'Animal Physiology': 'The study of the functions and processes of animal bodies.',
      'Comparative Anatomy': 'The study of similarities and differences in animal structures across species.',
      'Evolution': 'The process of change in living organisms over generations through natural selection.',
      'Microbiology': 'The study of microscopic organisms, such as bacteria, viruses, archaea, fungi, and protozoa.',
      'Bacteriology': 'The study of bacteria and their characteristics, diseases, and roles.',
      'Virology': 'The study of viruses and viral diseases.',
      'Mycology': 'The study of fungi including their genetics, biochemistry, and uses.',
      'Parasitology': 'The study of parasites and their relationships with host organisms.',
      'Microbial Ecology': 'The study of the interactions of microorganisms with their environment.',
      'Microbial Genetics': 'The study of the genetics of microorganisms.',
      'Genetics': 'The study of genes, genetic variation, and heredity in living organisms.',
      'Classical Genetics': 'The study of inheritance patterns using breeding experiments and pedigree analysis.',
      'Molecular Genetics': 'The study of the structure and function of genes at the molecular level.',
      'Population Genetics': 'The study of genetic variation and change within populations.',
      'Quantitative Genetics': 'The study of traits controlled by multiple genes and environmental factors.',
      'Evolutionary Genetics': 'The study of genetic mechanisms underlying evolutionary change.',
      'Human Genetics': 'The study of inheritance as it occurs in human beings.',
      'Ecology': 'The study of interactions among organisms and their environment.',
      'Population Ecology': 'The study of populations of organisms and their dynamics.',
      'Community Ecology': 'The study of interactions between species in ecological communities.',
      'Ecosystem Ecology': 'The study of energy flow and nutrient cycling in ecosystems.',
      'Biogeography': 'The study of the distribution of species and ecosystems across space and time.',
      'Conservation Biology': 'The science of protecting and preserving biodiversity.',
      'Restoration Ecology': 'The practice of renewing and restoring degraded ecosystems.',
      'Molecular Biology': 'The branch of biology that deals with the molecular basis of biological activity.',
      'DNA': 'The molecule that carries genetic information in living organisms.',
      'RNA': 'Nucleic acid molecules involved in protein synthesis and gene regulation.',
      'Protein Synthesis': 'The process by which cells build proteins from amino acids.',
      'Gene Expression': 'The process by which information from genes is used to synthesize functional products.',
      'Cell Biology': 'The study of the structure, function, and behavior of cells.',
      'Developmental Biology': 'The study of the processes by which organisms grow and develop.',
      'Earth Science': 'The study of the Earth\'s structure, properties, processes, and history, including geology, meteorology, and oceanography.',
      'Geology': 'The science concerned with the Earth\'s physical structure, substance, history, and processes.',
      'Plate Tectonics': 'The theory that Earth\'s outer shell is divided into moving plates.',
      'Rock Formation': 'The processes by which rocks are created, modified, and destroyed.',
      'Mineral Science': 'The study of minerals, their properties, and formation.',
      'Structural Geology': 'The study of rock deformation and the architecture of Earth\'s crust.',
      'Stratigraphy': 'The study of rock layers and their sequences.',
      'Geomorphology': 'The study of landforms and the processes that shape them.',
      'Meteorology': 'The study of the atmosphere and weather processes.',
      'Atmospheric Composition': 'The chemical makeup and structure of Earth\'s atmosphere.',
      'Weather Patterns': 'Recurring atmospheric conditions and their spatial distributions.',
      'Climate Systems': 'Long-term patterns of temperature, precipitation, and other atmospheric conditions.',
      'Storms': 'Atmospheric disturbances characterized by strong winds, precipitation, and other phenomena.',
      'Air Pollution': 'The contamination of the atmosphere by harmful substances.',
      'Climate Change': 'Long-term shifts in global temperatures and weather patterns.',
      'Oceanography': 'The exploration and scientific study of the ocean and its phenomena.',
      'Mineralogy': 'The study of minerals, their structure, properties, and classification.',
      'Seismology': 'The study of earthquakes and the propagation of seismic waves.',
      'Paleontology': 'The study of fossils and ancient life forms.',
      'Mathematics': 'The abstract science of numbers, quantity, structure, space, and change, using logical reasoning and quantitative calculation.',
      'Algebra': 'The branch of mathematics dealing with symbols and rules for manipulating them.',
      'Linear Algebra': 'The study of vectors, vector spaces, and linear transformations.',
      'Abstract Algebra': 'The study of algebraic structures such as groups, rings, and fields.',
      'Commutative Algebra': 'The study of commutative rings and their ideals and modules.',
      'Homological Algebra': 'The study of homology and cohomology in algebraic structures.',
      'Representation Theory': 'The study of abstract algebraic structures by representing their elements as linear transformations.',
      'Category Theory': 'The mathematical study of abstract structures and relationships between them.',
      'Geometry': 'The branch of mathematics concerned with properties of space, shapes, and figures.',
      'Euclidean Geometry': 'The study of plane and solid geometry based on Euclid\'s axioms.',
      'Non-Euclidean Geometry': 'Geometries that modify or reject Euclid\'s parallel postulate.',
      'Differential Geometry': 'The study of geometry using calculus and differential equations.',
      'Algebraic Geometry': 'The study of geometric objects defined by polynomial equations.',
      'Topology': 'The study of properties preserved under continuous deformations.',
      'Discrete Geometry': 'The study of geometric objects with discrete or combinatorial properties.',
      'Calculus': 'The mathematical study of continuous change involving derivatives and integrals.',
      'Differential Calculus': 'The study of rates of change and slopes of curves.',
      'Integral Calculus': 'The study of accumulation and areas under curves.',
      'Multivariable Calculus': 'The extension of calculus to functions of multiple variables.',
      'Complex Analysis': 'The study of functions of complex numbers.',
      'Functional Analysis': 'The study of infinite-dimensional vector spaces and operators.',
      'Harmonic Analysis': 'The study of representing functions as superpositions of basic waves.',
      'Statistics': 'The science of collecting, analyzing, interpreting, and presenting data.',
      'Probability': 'The mathematical study of random phenomena and likelihood.',
      'Descriptive Statistics': 'Methods for summarizing and describing data.',
      'Inferential Statistics': 'Methods for making inferences about populations from samples.',
      'Regression': 'Statistical methods for modeling relationships between variables.',
      'Bayesian Statistics': 'Statistical methods based on Bayes\' theorem and prior probabilities.',
      'Experimental Design': 'The planning of experiments to ensure valid and reliable results.',
      'Number Theory': 'The branch of mathematics devoted to the study of integers and their properties.',
      'Prime Numbers': 'Natural numbers greater than 1 divisible only by 1 and themselves.',
      'Modular Arithmetic': 'Arithmetic for integers where numbers wrap around after reaching a certain value.',
      'Diophantine Equations': 'Polynomial equations where only integer solutions are sought.',
      'Cryptography': 'The practice of secure communication using mathematical techniques.',
      'Analytic Number Theory': 'The use of analytical techniques to study properties of integers.',
      'Algebraic Number Theory': 'The study of algebraic structures related to algebraic integers.',
      'Astronomy': 'The scientific study of celestial objects, space, and the universe as a whole.',
      'Observational Astronomy': 'The practice of observing celestial objects and phenomena.',
      'Planetary Science': 'The study of planets, moons, and planetary systems.',
      'Inner Planets': 'The rocky planets closest to the Sun: Mercury, Venus, Earth, and Mars.',
      'Outer Planets': 'The gas and ice giants: Jupiter, Saturn, Uranus, and Neptune.',
      'Moons': 'Natural satellites orbiting planets and other celestial bodies.',
      'Asteroids': 'Small rocky bodies orbiting the Sun, primarily in the asteroid belt.',
      'Comets': 'Icy bodies that develop tails when approaching the Sun.',
      'Exoplanets': 'Planets orbiting stars outside our solar system.',
      'Stellar Astronomy': 'The study of stars, their properties, and evolution.',
      'Star Formation': 'The process by which dense regions of molecular clouds collapse to form stars.',
      'Star Life Cycle': 'The stages through which stars evolve from birth to death.',
      'Stellar Classification': 'The categorization of stars by their spectral characteristics.',
      'Binary Stars': 'Star systems consisting of two stars orbiting their common center of mass.',
      'Pulsars': 'Highly magnetized rotating neutron stars emitting beams of electromagnetic radiation.',
      'Neutron Stars': 'Extremely dense stellar remnants composed primarily of neutrons.',
      'Galactic Astronomy': 'The study of our Milky Way galaxy and its structure.',
      'Extragalactic Astronomy': 'The study of objects beyond the Milky Way galaxy.',
      // New Ethics Subdivisions (Normative/Metaethics/Applied)
      'Normative Ethics': 'The branch of ethics concerned with establishing criteria for right and wrong action, covering theories of virtue, duty, and consequences.',
      'Metaethics': 'Investigates the fundamental nature of morality, asking questions about what moral judgments mean, whether moral facts exist, and how we can know about them.',
      'Cognitivism vs Non-cognitivism': 'The central metaethical divide over whether moral statements express beliefs — and thus have truth values — or instead express emotions, commands, or attitudes.',
      'Cognitivism': 'The view that moral statements express beliefs and are therefore capable of being true or false.',
      'Non-cognitivism': 'The view that moral statements do not express beliefs or propositions and cannot be true or false — instead functioning to express emotions, commands, or attitudes.',
      'Moral Realism': 'The view that moral truths exist objectively, independent of individual opinions or beliefs.',
      'Moral Relativism': 'The view that moral truths vary depending on culture, individual perspective, or historical context.',
      'Moral Nihilism': 'The view that there are no objective moral facts or truths.',
      'Gene Ethics': 'The ethical examination of genetic engineering, modification, and inheritance manipulation.',
      'Organ Transplantation': 'The ethical issues surrounding the donation, allocation, and use of organs for medical purposes.',
      'Genetic Testing': 'The ethical considerations in testing for genetic conditions and disease predispositions.',
      'Reproductive Ethics': 'The ethical examination of reproduction, fertility, contraception, and genetic selection.',
      'Business Ethics': 'The examination of ethical principles in corporate behavior, profit, and stakeholder responsibility.',
      'Computer Ethics': 'The ethical issues surrounding technology, artificial intelligence, privacy, and digital rights.',
      // History of Philosophy
      'History of Philosophy': 'The chronological study of philosophical ideas, thinkers, and schools of thought across cultures and eras.',
      'Vedic Indian Philosophy (16th c BC - 6th c BC)': 'The foundational texts and thinkers of the Vedic tradition, seeking to understand the nature of reality, the self, and liberation through ethical conduct and interconnectedness.',
      'Vyasa (1500 BC)': 'Emphasized the interconnectedness of all existence and the pursuit of liberation (moksha) through self-knowledge and righteous action.',
      'Yajnavalkya (8th c BC)': 'Centers on the concept of Atman (self) and Brahman (ultimate reality) being identical, emphasizing self-knowledge as the path to liberation through "neti neti" (not this, not this).',
      'Kapila (7th c BC)': 'Posits a dualistic reality of Purusha (consciousness) and Prakriti (nature), advocating discriminative knowledge to liberate Purusha from the entanglements of Prakriti.',
      'Gautama (6th c BC)': 'Focuses on logic and epistemology, emphasizing valid knowledge (pramana) through perception, inference, comparison, and testimony to attain liberation from suffering.',
      'Kanada (6th c BC)': 'Proposes a pluralistic and realistic worldview, asserting that all objects are reducible to atoms and that liberation is achieved through understanding the categories of reality (padarthas).',
      'Jaimini (6th c BC)': 'Centers on the interpretation and application of Vedic rituals and injunctions, emphasizing ritual action (karma) to maintain cosmic order and attain desired results.',
      'Adi Shankara (788 AD - 820 AD)': 'Asserts the non-dualistic reality of Brahman, where Atman is ultimately identical to the absolute, and liberation is achieved through realizing this oneness and dispelling the illusion of separateness (Maya).',
      'Classical Chinese Philosophy (6th c BC - 3rd c BC)': 'The formative period of Chinese philosophical thought, producing Confucianism, Daoism, and Legalism.',
      'Confucianism (551 BC - present)': 'Emphasizes moral values, social harmony, and individual self-cultivation for the betterment of society.',
      'Confucius (Kong Fuzi) (551 BC - 479 BC)': 'Emphasizes ethical and social harmony through the cultivation of virtues like ren (benevolence), li (ritual propriety), and xiao (filial piety), promoting a well-ordered society based on moral example.',
      'Mencius (Mengzi) (372 BC - 289 BC)': 'Emphasized the innate goodness of human nature, advocating cultivation of moral sprouts and benevolent governance through the ruler\'s moral example.',
      'Xunzi (Xun Kuang) (3rd c BC)': 'Asserts that human nature is fundamentally bad, requiring moral education and ritual training to cultivate goodness and social order.',
      'Dong Zhongshu (179 BC - 104 BC)': 'Synthesized Confucianism with Yin-Yang cosmology and the Five Phases theory, advocating a hierarchical social order aligned with cosmic patterns.',
      'Daoism (6th c BC - present)': 'Encourages living in harmony with the natural flow of the universe, embracing simplicity, spontaneity, and non-interference.',
      'Laozi (Lao Tzu) (6th c BC)': 'Centers on the concept of the Dao (the Way), an ineffable natural force governing the universe. Advocates living in harmony through wu wei (non-action), emphasizing simplicity and acceptance of natural processes.',
      'Zhuangzi (Chuang Tzu) (369 BC - 286 BC)': 'Advocates transcending conventional distinctions and embracing the spontaneous flow of the Dao through "wandering freely," emphasizing relativity and acceptance of change.',
      'Legalism (4th c BC - 3rd c BC)': 'A pragmatic and authoritarian philosophy prioritizing social order and state power through strict laws and harsh punishments.',
      'Shang Yang (390 BC - 338 BC)': 'Advocated for a strict, centralized state governed by harsh laws and rewards, prioritizing agricultural production and military strength to achieve absolute power for the ruler.',
      'Hanfeizi (Han Fei) (280 BC - 233 BC)': 'Advocated for absolute state power through strict laws, impersonal rewards and punishments, and manipulative tactics to control officials.',
      'Li Si (280 BC - 208 BC)': 'Emphasized strict adherence to law and centralized authority, advocating suppression of dissent and standardization of thought to strengthen the state.',
      'Ancient Western Philosophy (6th c BC - 5th c AD)': 'The full arc of Western philosophy from the Pre-Socratics through the Roman era and Late Antiquity.',
      'Ancient Greek Philosophy (6th c BC - 1st c BC)': 'The foundational tradition of Western philosophy, from naturalistic Pre-Socratics through Plato, Aristotle, and the Hellenistic schools.',
      'Pre-Socratic Philosophy (6th c BC - 5th c BC)': 'Pioneers of rational inquiry who sought to explain the universe through observation and reason rather than myth, laying the foundation for Western philosophy.',
      'Milesian School/Ionian School (6th c BC)': 'Sought naturalistic explanations for the universe by identifying a single underlying substance (arche) from which all things originate.',
      'Thales of Miletus (~624 BC - ~545 BC)': 'Proposed that water is the fundamental substance from which all things originate, marking a shift toward naturalistic explanations of the universe.',
      'Anaximander of Miletus (610 BC - 546 BC)': 'Proposed the "apeiron," an indefinite and boundless substance, as the origin of all things, from which opposing qualities arise and return.',
      'Anaximenes of Miletus (545 BC)': 'Proposed that air is the fundamental substance of the universe, from which all other things are formed through condensation and rarefaction.',
      'Italian School (6th c BC - 5th c BC)': 'Centered in Magna Graecia, primarily the Pythagoreans and Eleatics, contributing distinct mathematical and metaphysical approaches to early Greek thought.',
      'Pythagorean School (6th - 5th c BC)': 'Emphasized that numbers and their relationships are the fundamental principles of reality, seeking to understand the cosmos through mathematical and mystical insights.',
      'Pythagoras of Samos (570 BC - 495 BC)': 'Taught that numbers are the essence of all things, advocating a way of life pursuing harmony and purification through mathematical study and mystical insights.',
      'Xenophanes (~565 BC - 478 BC)': 'Challenged traditional Greek polytheism, advocating for a single unchanging god and offering naturalistic explanations for phenomena, while questioning the certainty of human knowledge.',
      'Eleatic School (5th c BC)': 'Asserted the fundamental unity and unchanging nature of being, arguing that sensory experience is deceptive and true reality is singular and static.',
      'Parmenides of Elea (515 BC)': 'Argued that "what is, is" and "what is not, is not," asserting that reality is a single, unchanging, indivisible whole, and change is an illusion.',
      'Zeno of Elea (495 BC - 430 BC)': 'Defended Parmenides\' monistic philosophy by creating paradoxes demonstrating the apparent contradictions inherent in motion and plurality.',
      'Pluralists (5th c BC)': 'Sought to reconcile opposing Pre-Socratic views by proposing multiple fundamental substances, such as four elements or infinite seeds, to explain diversity and change.',
      'Empedocles of Acragas (494 BC - 434 BC)': 'Proposed that the universe is composed of four eternal elements — earth, air, fire, and water — combined and separated by the forces of Love and Strife.',
      'Anaxagoras of Clazomenae (500 BC - 428 BC)': 'Introduced the concept of "nous" (mind) as the ordering principle of the universe, asserting that all things are composed of infinitely divisible seeds containing qualities of everything.',
      'Atomists (5th c BC)': 'Proposed that the universe is composed of indivisible, indestructible atoms moving in a void, explaining all phenomena as the result of their collisions and combinations.',
      'Leucippus (480 BC - 420 BC)': 'Originated the atomic theory, positing that the universe consists of indivisible atoms and void, laying the foundation for a materialistic understanding of reality.',
      'Democritus of Abdera (460 BC - 370 BC)': 'Asserted that all reality consists of atoms and void, where atoms move and collide, forming the diverse world we perceive.',
      'Heraclitus of Ephesus (535 BC - 475 BC)': 'Declared "everything flows," emphasizing the constant flux of reality and the unity of opposites, asserting that change is the only constant.',
      'Classical Greek Philosophy (5th c BC - 4th c BC)': 'Sought to understand the world and human existence through reason, virtue, and the pursuit of the good life, laying the groundwork for much of Western philosophical tradition.',
      'Sophists (5th c BC - 4th c BC)': 'Focused primarily on rhetoric and argumentation, emphasizing relativism and skepticism, teaching that truth and morality are often matters of persuasion.',
      'Protagoras (490 BC - 420 BC)': 'Famously asserted that "man is the measure of all things," implying that truth is relative to individual perception.',
      'Gorgias (485 BC - 380 BC)': 'A master of rhetoric who argued that nothing exists, and if it did exist it could not be known, and if known it could not be communicated — a radical skepticism.',
      'Socrates (469 BC - 399 BC)': 'Through dialectic questioning, sought to expose the limitations of conventional wisdom and promote self-examination, believing "the unexamined life is not worth living."',
      'Plato (~428 BC - ~347 BC)': 'Centered on the Theory of Forms, asserting that true reality exists in a realm of eternal unchanging Forms, of which the physical world is merely a shadow, and knowledge is attained through reason.',
      'Aristotle (384 BC - 322 BC)': 'Emphasized empirical observation and logical analysis, seeking to understand the natural world through systematic categorization and identification of causes.',
      'Hellenistic Philosophy (3rd c BC - 1st c BC)': 'The philosophical schools of the post-Alexandrian world, emphasizing practical ethics and how to live well amid uncertainty.',
      'Skepticism (4th c BC - 3rd c AD)': 'The philosophical tradition questioning the possibility of knowledge and advocating suspension of judgment to achieve tranquility.',
      'Pyrrhonism (360 BC - present)': 'A radical skeptical tradition advocating suspension of judgment (epoché) on all matters to achieve peace of mind (ataraxia).',
      'Pyrrho of Elis (360 BC - 270 BC)': 'Promoted radical skepticism, urging suspension of judgment to achieve peace of mind, believing true knowledge is unattainable.',
      'Timon of Phlius (320 BC - 230 BC)': 'Known for advocacy of Pyrrhonism, emphasizing suspension of judgment for tranquility, and for satirical works critiquing dogmatic philosophies.',
      'Aenesidemus (1st c BC)': 'Aimed to revive and systematize Pyrrho\'s skepticism by developing the "ten modes" of skepticism, arguing for suspension of judgment due to the inherent relativity of perception.',
      'Sextus Empiricus (2nd c AD - 3rd c AD)': 'Advocated skepticism as a means to achieve ataraxia by suspending judgment, arguing that nothing can be known with certainty.',
      'Epicureanism (306 BC - present)': 'Advocates achieving a life of lasting happiness and tranquility by focusing on simple pleasures, avoiding unnecessary pain, and cultivating meaningful relationships.',
      'Epicurus (341 BC - 270 BC)': 'Centered on achieving a tranquil and happy life, free from fear and pain, through the pursuit of simple pleasures and the avoidance of unnecessary desires.',
      'Metrodorus of Lampsacus (331 BC - 278 BC)': 'A close disciple of Epicurus who shared his hedonistic philosophy, emphasizing that happiness derived from bodily and mental tranquility is the ultimate good.',
      'Hermarchus of Mytilene (3rd c BC)': 'Successor to Epicurus, continued the Epicurean tradition emphasizing the pursuit of pleasure understood as freedom from pain and disturbance.',
      'The Cynics (4th c BC - 4th c AD)': 'Advocated for a life of virtue lived in accordance with nature by rejecting all conventional desires for wealth, power, and social status.',
      'Antisthenes (445 BC - 365 BC)': 'Advocated for a life of virtue achieved through simplicity and rejection of conventional pleasures.',
      'Diogenes of Sinope (~407 BC - ~322 BC)': 'Embodied radical Cynicism, living an austere life to demonstrate the absurdity of social conventions and the importance of self-sufficiency.',
      'Crates of Thebes (3rd c BC)': 'Renounced his wealth to live a simple Cynic life, promoting virtue and indifference to material possessions.',
      'Stoicism (300 BC - present)': 'Cultivate inner peace and virtue by living in harmony with nature, accepting what cannot be changed, and focusing on what is within one\'s control.',
      'Early Stoa (300 BC - 2nd c BC)': 'The founding generation of Stoic philosophy, establishing its core doctrines of virtue, reason, and living in accordance with nature.',
      'Zeno of Citium (334 BC - 262 BC)': 'Founded the Stoic school, emphasizing that living virtuously in accordance with nature and reason is the path to happiness.',
      'Cleanthes of Assos (330 BC - 230 BC)': 'Emphasized living in accordance with nature, adding this element to Stoic philosophy and stressing that a virtuous life aligns with the rational order of the universe.',
      'Chrysippus of Soli (280 BC - 207 BC)': 'Developed and systematized Stoic philosophy, particularly in logic, physics, and ethics, creating a comprehensive framework.',
      'Middle Stoa (2nd c BC - 1st c AD)': 'Maintained core Stoic emphasis on virtue and reason while incorporating elements from other traditions and placing greater emphasis on social duties.',
      'Panaetius of Rhodes (185 BC - 110 BC)': 'Adapted Stoic philosophy to Roman sensibilities, emphasizing practical ethics and a more moderate approach to virtue, thereby significantly influencing Roman thought.',
      'Posidonius of Apameia (135 BC - 51 BC)': 'Integrated vast scientific and philosophical inquiries, emphasizing the interconnectedness of the cosmos, while adjusting Stoic doctrine to include Platonic concepts of the soul.',
      'Late Stoa/Roman Stoicism (1st c AD - 2nd c AD)': 'Provided a practical guide to living a virtuous and fulfilling life, emphasizing self-control, resilience, and inner peace.',
      'Seneca the Younger (4 BC - 65 AD)': 'Emphasized that true happiness comes from living virtuously in accordance with nature and reason, focusing on inner peace and acceptance of what one cannot control.',
      'Epictetus (50 AD - 135 AD)': 'Taught that true freedom and happiness come from recognizing what is within our control (our judgments and attitudes) and accepting what is not (external events).',
      'Marcus Aurelius (121 AD - 180 AD)': 'As expressed in his "Meditations," emphasizes living a life of virtue, reason, and acceptance, focusing on inner peace and fulfilling one\'s duty to oneself and society.',
      'Roman Philosophy (1st c AD - 5th c)': 'A pragmatic and ethical approach to life, emphasizing virtue, duty, and inner peace, drawing heavily from the legacy of Greek thought.',
      'Cicero (Marcus Tullius Cicero) (106 BC - 43 BC)': 'Emphasized a blend of Stoic ethics, Academic skepticism, and Roman political ideals, advocating for a virtuous life in service to the republic, guided by natural law.',
      'Lucretius (Titus Lucretius Carus) (c. 99 BC - c. 55 BC)': 'Through "De rerum natura," aimed to liberate people from fear and superstition by explaining the universe through Epicurean materialism, emphasizing atoms and void.',
      'Late Antiquity (1st c AD - 6th c AD)': 'The philosophical era spanning the height of the Roman Empire through its decline, encompassing Neoplatonism, early Christianity, and the transition to medieval thought.',
      'Imperial Philosophy (27 BC - 6th c AD)': 'The philosophical movements of the Roman Imperial period, dominated by Neoplatonism and the synthesis of Platonic traditions.',
      'Neoplatonism (3rd c AD - 6th c AD)': 'A journey of ascent striving to transcend the material world and return to the ultimate source of all being, The One, through intellectual and mystical contemplation.',
      'Plotinus (~204 AD - 270 AD)': 'Centers on the idea of emanation from "the One," a transcendent source, and the soul\'s journey to return to that ultimate unity through contemplation and mystical experience.',
      'Porphyry (234 AD - 305 AD)': 'Focused on reconciling Platonic and Aristotelian thought, emphasizing the soul\'s ascent to the divine through philosophical contemplation and ascetic practices.',
      'Iamblichus (245 AD - 325 AD)': 'Emphasized theurgical practices and divine hierarchies, believing rituals and invocations could purify the soul and facilitate its ascent to the divine.',
      'Hypatia of Alexandria (360 AD - 415 AD)': 'Emphasized reason, mathematics, and philosophical inquiry, advocating for the pursuit of knowledge and virtue as paths to understanding the divine.',
      'Proclus (412 AD - 485 AD)': 'Systematized Neoplatonism, developing a complex metaphysical system detailing hierarchical emanations from the One, emphasizing the soul\'s ascent through contemplation and divine illumination.',
      'Early Christian Philosophy (150 AD - 500 AD)': 'Sought to establish a coherent intellectual framework for Christian faith, integrating it with the philosophical heritage of the ancient world.',
      'The Apostle Paul (1st c AD - ~67 AD)': 'Centered on the transformative power of faith in Jesus Christ, emphasizing salvation through grace and the establishment of a new covenant transcending ethnic and legalistic boundaries.',
      'Justin Martyr (~100 AD - 165 AD)': 'Sought to demonstrate the rationality and truth of Christianity by bridging Greek philosophy and Christian theology, arguing the "Logos" found its fullness in Jesus Christ.',
      'Irenaeus of Lyons (2nd c AD)': 'Emphasized the continuity of apostolic tradition and the unity of God\'s plan of salvation, countering Gnostic heresies by affirming one God and one true church.',
      'Clement of Alexandria (150 AD - ~216 AD)': 'Sought to integrate Greek philosophy with Christian theology, viewing philosophy as preparatory for Christian revelation, and emphasizing "gnosis" for deeper understanding of God.',
      'Tertullian (~155 AD - 220 AD)': 'Fiercely defended orthodox Christianity against heresies, famously questioning the compatibility of philosophical inquiry with Christian faith, emphasizing scripture and tradition.',
      'Origen of Alexandria (185 AD - 254 AD)': 'Sought to synthesize Christian theology with Platonic philosophy, emphasizing allegorical scripture interpretation, pre-existence of souls, and the ultimate restoration of all creation.',
      'Augustine of Hippo/Saint Augustine (354 AD - 430 AD)': 'Intertwined Platonic thought with Christian doctrine, emphasizing that human happiness is found in union with God, achieved through divine grace and inner spiritual life.',
      'Late Neoplatonism (350 AD - 500 AD)': 'Sought to provide a comprehensive framework for understanding the soul\'s relationship to the divine, emphasizing ritual, theurgy, and reconciliation of diverse philosophical traditions.',
      'Damascius (480-550)': 'The last head of the Neoplatonic Academy in Athens, focused on the limits of human understanding of ultimate principles, emphasizing the ineffable nature of the first cause.',
      'Simplicius of Cilicia (490-560)': 'Sought to preserve and interpret the works of Plato and Aristotle, emphasizing the harmony between their philosophies and defending traditional pagan thought.',
      'Olympiodorus the Younger (5th c - 6th c)': 'Focused on interpreting and teaching Plato\'s dialogues, emphasizing the soul\'s ascent through philosophical contemplation.',
      'The Transition to Medieval Philosophy (500 AD - 800 AD)': 'A shift from secular to theocentric focus, integrating classical philosophical traditions into a framework of religious faith and theological inquiry.',
      'Boethius (Anicius Manlius Severinus Boethius) (480-~525)': 'In "The Consolation of Philosophy," explored the problem of evil and happiness, arguing true happiness lies in aligning with divine providence rather than transient worldly fortune.',
      'Cassiodorus (485-585)': 'Aimed to preserve classical learning and integrate it with Christian teachings, establishing monasteries as centers of scholarship.',
      'John Philoponus (490-570)': 'Challenged Aristotelian physics and cosmology, advocating a creationist worldview and developing a theory of impetus that anticipated later developments in mechanics.',
      'Pseudo-Dionysius the Areopagite (5th c - 6th c)': 'Mystical theology emphasized the "via negativa" (negative way), arguing that God\'s essence is beyond human comprehension and can only be approached through negation.',
      'Isidore of Seville (560-636)': 'Centered on compiling and preserving classical knowledge within a Christian framework, creating a comprehensive encyclopedia ("Etymologiae") foundational to medieval education.',
      'Classical Indian Philosophy (6th c BC - 11th c AD)': 'The rich tradition of Indian philosophical thought encompassing Jainism, Buddhism, and the development of major schools of Hindu philosophy.',
      'Jainism (8th c BC - present)': 'A path to spiritual liberation through ethical living, non-violence, and self-discipline, emphasizing the interconnectedness of all living beings and minimizing harm.',
      'Rishabhanatha (an eternity away in the past)': 'The first Tirthankara in Jainism, taught a path of non-violence (ahimsa), truthfulness, non-stealing, celibacy, and non-possession as means to liberation.',
      'Parshvanatha (8th c BC - 7th c BC)': 'The twenty-third Tirthankara in Jainism, preached a philosophy emphasizing four restraints — non-violence, truthfulness, non-stealing, and non-possession — as essential for spiritual liberation.',
      'Mahavira (599 BC - 527 BC)': 'The twenty-fourth Tirthankara, articulated Jainism\'s core principles of ahimsa (non-violence), anekantavada (non-absolutism), and aparigraha (non-possessiveness).',
      'Indian Buddhism (6th c BC - present)': 'Seeks to understand the nature of suffering, its causes, and its cessation, following the Noble Eightfold Path to achieve liberation and enlightenment.',
      'Siddhartha Gautama (the Buddha) (6th c BC - 4th c BC)': 'Taught the Four Noble Truths and the Eightfold Path, emphasizing cessation of suffering through ethical conduct, mental discipline, and wisdom.',
      'Emperor Ashoka (268 BC - 232 BC)': 'Centered on Dhamma, a principle of righteous living emphasizing non-violence, tolerance, and social welfare, applied to imperial governance.',
      'Nagarjuna (150 AD - 250 AD)': 'All phenomena are empty of inherent existence, emphasizing the concept of śūnyatā (emptiness) in Madhyamaka Buddhist philosophy.',
      'Vasubandhu (4th c AD)': 'Consciousness is the sole reality, advocating for the Yogācāra school\'s "consciousness-only" doctrine.',
      'Dignāga (5th c AD)': 'Revolutionized Buddhist epistemology through a system of logic and perception, emphasizing that only directly perceived particulars and logically constructed universals are valid knowledge.',
      'Imperial Chinese Philosophy (3rd c BC - 20th c AD)': 'The philosophical traditions of imperial China, dominated by Neo-Confucianism and Chinese Buddhism.',
      'Neo-Confucianism (960 - present)': 'Sought a comprehensive worldview integrating ethical, metaphysical, and social dimensions, emphasizing moral self-cultivation and investigation of principles.',
      'Han Yu (768-824)': 'Centered on a vigorous revival of Confucianism, advocating a return to classical Confucian values and strongly criticizing Buddhism and Daoism\'s influence.',
      'Zhou Dunyi (1017-1073)': 'Synthesized Confucian ethics with Daoist cosmology, emphasizing the "Supreme Ultimate" (Taiji) as the source of all creation and advocating moral self-cultivation through sincerity.',
      'Zhang Zai (1020-1077)': 'Emphasized that all things are composed of "qi" (vital force), advocating a unified cosmos where humanity and the universe are interconnected, promoting ethics rooted in this interconnectedness.',
      'Cheng Hao (1032-1085)': 'Emphasized "ren" (humaneness) as the fundamental principle of the universe, advocating for sagehood through cultivating one\'s innate moral nature.',
      'Cheng Yi (1033-1107)': 'Emphasized the investigation of "li" (principle), asserting it is the underlying rational order of the universe and that moral cultivation involves understanding and adhering to these principles.',
      'Zhu Xi (1130-1200)': 'Integrated Confucian ethics with Daoist and Buddhist metaphysics, emphasizing investigation of things (gewu) to understand underlying principles (li), cultivating sagehood through moral and intellectual inquiry.',
      'Wang Yangming (1472-1529)': 'Emphasized the "unity of knowledge and action" and the idea that innate moral knowledge ("liangzhi") resides within every person\'s mind, advocating self-cultivation through introspection.',
      'Chinese Buddhism (1st c AD - present)': 'Sought to integrate the universal message of Buddhist enlightenment with the specific cultural and philosophical traditions of China.',
      'An Shigao (2nd c AD)': 'Centered on the foundational act of introducing and translating key Buddhist texts into Chinese, establishing the initial framework for Buddhist doctrine and meditation practices.',
      'Kumārajiva (344-413)': 'Masterful translation of key Mahāyāna Buddhist texts into Chinese, significantly shaping Chinese Buddhism by accurately conveying Madhyamaka philosophy.',
      'Tanluan (476-542)': 'Centered on the "Other Power" of Amitābha Buddha, emphasizing that salvation is achieved through faith and reliance on Amitābha\'s vows, laying the groundwork for Pure Land Buddhism.',
      'Bodhidharma (5th c - 6th c)': 'Emphasized direct, experiential understanding of Buddhist truth through meditation, advocating a "special transmission outside the scriptures" focused on "seeing one\'s true nature."',
      'Zhiyi (538-597)': 'Centered on the "Threefold Truth" and the Tiantai school\'s complex system of classifying Buddhist teachings, understanding reality as interconnected and dynamically changing.',
      'Xuanzang (602-664)': 'Focused on accurate transmission of Yogācāra doctrines through meticulous translation, establishing the "Consciousness-Only" school in China.',
      'Hui Neng (638-713)': 'Centered on "sudden enlightenment," asserting that enlightenment is an innate potential accessible through direct insight into one\'s own Buddha-nature, rather than gradual practice.',
      'Fazang (643-712)': 'Central to the Huayan school, emphasized the interconnectedness and mutual interpenetration of all phenomena, illustrating that all things are simultaneously individual and contained within everything else.',
      'Wang Wei (701-761)': 'Reflects a harmonious integration of Chan Buddhist principles, particularly emptiness, with Taoist appreciation for nature, expressed through serene poetry and landscape painting.',
      'Medieval Western Philosophy (5th c - 15th c)': 'Sought to provide rational foundations for Christian faith, integrating classical philosophical insights with Christian doctrine and preserving ancient learning.',
      'Early Medieval (5th c - 11th c)': 'Sought to provide a rational foundation for Christian faith, integrating classical philosophical insights with Christian doctrine.',
      'John Scotus Eriugena (810-877)': 'Sought to reconcile Neoplatonic thought with Christian theology, positing a hierarchical universe where all reality emanates from and returns to God.',
      'Scholasticism (11th c - 17th c)': 'The dominant method of critical thought in medieval European universities, applying rigorous logical analysis to theological and philosophical questions.',
      'Nominalism (11th c - 21st c)': 'The view that general concepts are merely names or mental constructs, and that only individual things exist in reality.',
      'Roscellinus (1050-1125)': 'Asserted that universal concepts are mere words or mental abstractions, denying their real existence independent of individual things.',
      'Peter Abelard (1079-1142)': 'Emphasized dialectical reasoning and logical analysis to resolve theological disputes, advocating for a nuanced understanding of faith informed by reason.',
      'William of Ockham (1287-1347)': 'Characterized by "Ockham\'s Razor," advocating simplicity and parsimony, asserting that entities should not be multiplied beyond necessity.',
      'Thomas Hobbes (1588-1679)': 'Argued that human nature is fundamentally self-interested and that a strong sovereign is necessary to prevent society from descending into a "war of all against all."',
      'Pierre Gassendi (1592-1655)': 'Revived Epicurean atomism, advocating a mechanistic understanding of the natural world based on atoms and void, while attempting to reconcile this with Christian theology.',
      'Nelson Goodman (1906-1998)': 'Challenged traditional notions of induction, confirmation, and aesthetics, emphasizing the role of symbol systems and "worldmaking" in shaping our understanding of reality.',
      'Thomism (13th c - 21st c)': 'Provides a comprehensive worldview integrating faith and reason, emphasizing God as the ultimate source of reality and the pursuit of human flourishing through virtue and divine grace.',
      'St. Thomas Aquinas (1225-1274)': 'Sought to synthesize Aristotelian philosophy with Christian theology, emphasizing that reason and faith are harmonious paths to truth, and that God is the ultimate source of both.',
      'Cardinal Cajetan (1469-1534)': 'Centered on a Thomistic interpretation of Aristotelian metaphysics and theology, particularly concerning analogy, the soul, and the relationship between divine grace and human free will.',
      'Francisco Suárez (1548-1617)': 'Sought to synthesize and refine Scholastic thought, particularly Aquinas, while developing original contributions in metaphysics, law, and political theory.',
      'Karl Rahner (1904-1984)': 'Deeply rooted in transcendental Thomism, emphasized the human person\'s inherent openness to God and sought to bridge traditional Catholic theology and modern existential experience.',
      'Neo-Thomism (19th c - present)': 'Re-presenting and re-applying the wisdom of Thomas Aquinas to the modern world, defending its enduring relevance for contemporary philosophical and ethical challenges.',
      'Pope Leo XIII (1810-1903)': 'Articulated in Aeterni Patris, centered on the revival of Thomistic philosophy to combat modern errors and promote harmony between faith and reason, while addressing social issues.',
      'Jacques Maritain (1882-1973)': 'Sought to integrate Thomistic principles with modern thought, advocating for humanistic personalism grounded in natural law, and promoting art, democracy, and social justice.',
      'Étienne Gilson (1884-1978)': 'Centered on a historical and systematic revival of medieval Christian philosophy, particularly Thomism, emphasizing the enduring relevance of metaphysical realism.',
      'Edith Stein (1891-1942)': 'Integrated phenomenology with Thomistic metaphysics, exploring the nature of empathy, the human person, and the relationship between finite and divine being, culminating in reflection on the cross.',
      'Scotism (13th c - 21st c)': 'Emphasizes the freedom of will, the individuality of beings, and a more direct relationship between God and creation.',
      'John Duns Scotus (~1265-1308)': 'Characterized by his emphasis on the "univocity of being," the concept of "haecceitas" (thisness) for individual distinction, and a voluntarist understanding of free will.',
      'Francis of Meyronne (1280-1328)': 'Rooted in Scotist thought, focused on rigorous logical analysis and metaphysical distinctions, particularly concerning being, knowledge, and divine attributes.',
      'Golden Age Islamic Philosophy (8th c - 13th c)': 'Sought to integrate Islamic faith with the insights of classical philosophy and science, fostering a rich intellectual tradition that shaped both the Islamic world and the West.',
      'Al-Kindi (801-873)': 'Sought to integrate Aristotelian and Neoplatonic thought with Islamic theology, emphasizing the compatibility of reason and revelation, with contributions to mathematics and astronomy.',
      'Al-Farabi (872-950)': 'Aimed to harmonize Platonic and Aristotelian thought within an Islamic framework, emphasizing reason and political philosophy for achieving human happiness.',
      'Avicenna (Ibn Sina) (980-1037)': 'Sought to synthesize Aristotelian and Neoplatonic thought with Islamic theology, notably through his concept of "necessary existence" and his comprehensive system of medicine.',
      'Al-Ghazali (1058-1111)': 'Sought to reconcile Islamic orthodoxy with Sufi mysticism, emphasizing direct spiritual experience and the limitations of purely rational inquiry in attaining knowledge of God.',
      'Ibn Bajjah (Avempace) (1085-1138)': 'Influenced by Aristotelianism and Neoplatonism, focused on the intellectual and spiritual development of the individual, emphasizing a solitary contemplative life.',
      'Ibn Tufail (1105-1185)': 'In his allegorical novel Hayy ibn Yaqdhan, explores the possibility of attaining philosophical and religious truth through independent reason and contemplation of nature.',
      'Ibn Rushd (Averroes) (1126-1198)': 'Deeply rooted in Aristotelianism, sought to defend the compatibility of philosophy and Islamic theology, arguing for the autonomy of reason and logical demonstration.',
      'Medieval Indian Philosophy (8th c - 18th c)': 'A dynamic period marked by sophisticated philosophical systems, devotional movements, and ongoing engagement with diverse religious and intellectual traditions.',
      'Vedanta Schools (8th c - present)': 'Realizing the ultimate reality of Brahman and achieving liberation from suffering through knowledge and self-realization.',
      'Ramanuja (1017-1137)': 'Central to Vishishtadvaita Vedanta, asserts qualified non-dualism, emphasizing that Brahman is the supreme reality with individual souls and the material world as his attributes, promoting bhakti.',
      'Madhvacharya (1238-1317)': 'Central to Dvaita Vedanta, asserts strict dualism, emphasizing the absolute distinction between God (Vishnu) and individual souls, advocating devotion and knowledge as means to liberation.',
      'Vallabhacharya (1479-1531)': 'Known as Shuddhadvaita (pure non-dualism), emphasizes the pure, undivided nature of Brahman (Krishna), asserting the world is a manifestation of Krishna\'s essence and bhakti is the path to liberation.',
      'Nyaya and Vaisheshika (10th c - present)': 'Provides a systematic and logical approach to understanding the world, emphasizing valid knowledge and the atomic nature of reality in the pursuit of liberation.',
      'Udayana (10th c - 11th c)': 'Rigorously defended theistic realism and advanced Nyaya epistemology through logical arguments, most notably establishing rational foundations for the existence of God.',
      'Basava (1131-1167)': 'Central to the Lingayat tradition, emphasized devotion to Shiva through personal experience and social reform, rejecting caste distinctions and advocating direct communion with the divine.',
      'Gangesha Upadhyaya (13th c - 14th c)': 'Revolutionized Nyaya through the "Tattvacintamani," establishing Navya-Nyaya with its refined logical language and rigorous epistemological analysis.',
      'Post-Classical Islamic Philosophy (13th c - 19th c)': 'Saw a shift toward greater emphasis on Sufism, theology, and Islamic law, while reason was often subordinated to religious experience and scriptural authority.',
      'Fakhr al-Din al-Razi (1149-1209)': 'Critically engaged with diverse intellectual traditions, emphasizing divine omnipotence and the limitations of human reason within a comprehensive Islamic theological framework.',
      'Suhrawardi (1155-1191)': 'Known as the "Philosophy of Illumination" (Ishraq), emphasized intuitive knowledge and mystical experience, positing a hierarchical universe of light emanating from the "Light of Lights."',
      'Ibn Arabi (1165-1240)': 'Central to Wahdat al-Wujud (the Oneness of Being), posits that all existence is a manifestation of the single divine reality, emphasizing the unity of God and creation.',
      'Nasir al-Din al-Tusi (1201-1274)': 'Integrated Aristotelian and Islamic thought, contributing to logic, mathematics, astronomy, and ethics, while emphasizing reason and observation in understanding the cosmos.',
      'Ibn Khaldun (1332-1406)': 'Developed a cyclical theory of history, emphasizing social and economic factors in the rise and fall of civilizations, and introducing "asabiyyah" (social cohesion) to explain historical change.',
      'Mulla Sadra (1572-1640)': 'Known as "Transcendent Philosophy," synthesized Peripatetic philosophy, Illuminationism, and Sufism, emphasizing "substantial motion" and the unity of being through gradual actualization.',
      'Western Renaissance Philosophy (15th c - 16th c)': 'Marked a transition from a medieval worldview to a modern one, emphasizing human potential, classical learning, scientific inquiry, and a more secular outlook.',
      'Marsilio Ficino (1433-1499)': 'Centered on reviving Neoplatonism, aiming to synthesize it with Christianity, and emphasizing the central role of the human soul as a link between the material and divine realms.',
      'Giovanni Pico della Mirandola (1463-1494)': 'Articulated in his "Oration on the Dignity of Man," emphasized human free will and the potential to ascend or descend the chain of being through one\'s own choices.',
      'Erasmus of Rotterdam (1466-1536)': 'Rooted in Christian humanism, advocated for a return to the original sources of Christianity, emphasizing inner piety, moral reform, and the use of reason to promote peace.',
      'Niccolò Machiavelli (1469-1527)': 'Articulated in "The Prince," advocated for a pragmatic, realistic approach to politics, prioritizing the acquisition and maintenance of power over traditional moral considerations.',
      'Nicolaus Copernicus (1473-1543)': 'Centered on the heliocentric model of the universe, positing that the Sun, not the Earth, is at the center, fundamentally altering humanity\'s understanding of its place in the cosmos.',
      'Michel de Montaigne (1533-1592)': 'Expressed through his "Essays," advocated for skepticism, self-examination, and a tolerant approach to life, emphasizing individual experience and the limitations of human knowledge.',
      'Giordano Bruno (1548-1600)': 'Characterized by pantheistic cosmology, posited an infinite universe filled with countless worlds, emphasizing the unity of all being and the divine immanence in nature.',
      'Early Modern Western Philosophy (17th c - 18th c)': 'The era of rationalism, empiricism, and the Enlightenment — establishing modern philosophy\'s foundations through Descartes, Locke, Hume, and Kant.',
      'Continental Rationalism (17th c)': 'The pursuit of certain knowledge through reason and innate ideas, aiming to construct a comprehensive and coherent understanding of reality.',
      'René Descartes (1596-1650)': 'Marked by his method of radical doubt, sought to establish a foundation for certain knowledge, famously summarized in "Cogito, ergo sum," and advocated for a dualistic view of mind and body.',
      'Blaise Pascal (1623-1662)': 'Explored the human condition\'s inherent contradictions, advocating for faith and a "wager" on God as a response to the limitations of reason and the uncertainties of existence.',
      'Baruch Spinoza (1632-1677)': 'In his "Ethics," developed a rationalistic system positing a single substance (God or Nature) and emphasizing the power of reason to achieve intellectual and emotional freedom.',
      'Gottfried Wilhelm Leibniz (1646-1716)': 'Characterized by his concept of "monads" as fundamental substances, aimed to reconcile science and metaphysics, advocating for a pre-established harmony in a "best of all possible worlds."',
      'British Empiricism (17th c - 18th c)': 'Holds that sensory experience is the foundation of all knowledge, and that philosophical inquiry should be grounded in observation and empirical evidence.',
      'John Locke (1632-1704)': 'Asserted that knowledge originates from sensory experience and reflection, advocating for natural rights, limited government, and the importance of individual liberty.',
      'George Berkeley (1685-1753)': 'Immaterialism asserted "to be is to be perceived" (esse est percipi), arguing that physical objects exist only as ideas in the minds of perceivers, including God.',
      'The Enlightenment (18th c)': 'A call to use reason, individualism, and scientific inquiry to challenge traditional authority, promote human rights, and create a more just and enlightened society.',
      'Montesquieu (Charles-Louis de Secondat, baron de Montesquieu) (1689-1755)': 'Advocated for the separation of powers in government, emphasizing the importance of checks and balances to prevent tyranny and preserve liberty.',
      'Voltaire (François-Marie Arouet) (1694-1778)': 'Championed reason, tolerance, and freedom of thought, fiercely criticizing religious and political intolerance, and advocating for enlightened reform.',
      'Jean-Jacques Rousseau (1712-1778)': 'Emphasizing natural goodness and the social contract, argued that civilization corrupts individuals, advocating for a political system based on the general will.',
      'Denis Diderot (1713-1784)': 'Championed reason, skepticism, and materialism, advocating for the dissemination of knowledge through the "Encyclopédie" and challenging traditional authority.',
      'Thomas Jefferson (1743-1826)': 'Emphasized natural rights, individual liberty, and republicanism, advocating for limited government, popular sovereignty, and the pursuit of happiness.',
      'Mary Wollstonecraft (1759-1797)': 'A pioneering voice for women\'s rights, argued for the equality of the sexes based on shared capacity for reason, advocating for women\'s education and political participation.',
      'Scottish Enlightenment (1740-1790)': 'Scotland\'s distinctive philosophical contributions to the Enlightenment, encompassing empiricism, common sense philosophy, and moral philosophy.',
      'Scottish Empiricism (18th c)': 'The Scottish tradition of grounding knowledge in sensory experience and observation, culminating in Hume\'s influential skepticism.',
      'David Hume (1711-1776)': 'A cornerstone of Scottish empiricism, emphasized skepticism and the limitations of human reason, arguing that knowledge derives from experience and causation is a matter of custom, not necessity.',
      'Scottish Common Sense Realism (18th c - 19th c)': 'Countered Humean skepticism by asserting the reliability of innate cognitive faculties and common sense judgments about the external world.',
      'Thomas Reid (1710-1796)': 'Central to Scottish Common Sense Realism, countered Hume\'s skepticism by asserting the reliability of innate cognitive faculties and common sense judgments about the external world.',
      'Dugald Stewart (1753-1828)': 'Popularized and refined Scottish Common Sense Realism, emphasizing mental philosophy and the importance of moral sentiment and education in shaping virtuous character.',
      'Scottish Moral Philosophy (18th c - 19th c)': 'Explored the foundations of morality in human nature, sentiment, and social life, influencing both ethics and economics.',
      'Francis Hutcheson (1694-1746)': 'Emphasized the existence of a "moral sense" that intuitively perceives virtue and vice, advocating for benevolence and the greatest happiness principle as the foundation of ethics.',
      'Adam Smith (1723-1790)': 'Explored the interconnectedness of morality and economics, arguing that individual self-interest, guided by sympathy and constrained by free markets, contributes to social harmony and prosperity.',
      'Adam Ferguson (1723-1816)': 'Emphasized the social nature of humanity and the unplanned, evolutionary development of societies, highlighting civic virtue and social interaction for human flourishing.',
      'Thomas Brown (1778-1820)': 'Building upon Scottish Common Sense Realism, refined the analysis of the mind, emphasizing suggestion and association in shaping our thoughts and emotions.',
      'Edo Japanese Philosophy (1603-1868)': 'Sought to create a stable and harmonious society by blending ethical principles with an appreciation for the beauty and impermanence of life.',
      'Fujiwara Seika (1561-1619)': 'A pivotal figure in the development of Neo-Confucianism in Japan, emphasizing moral philosophy and practical ethics, and contributing to its integration into Japanese intellectual life.',
      'Hayashi Razan (1583-1657)': 'Synthesized Neo-Confucianism to serve the Tokugawa shogunate, creating a philosophical framework emphasizing hierarchical social order and supporting government stability.',
      'Itō Jinsai (1627-1705)': 'Advocated a return to the original teachings of Confucius, emphasizing practical ethics and the study of ancient texts, while rejecting Neo-Confucian metaphysical interpretations.',
      'Kaibara Ekiken (1630-1714)': 'Popularized Neo-Confucianism in Japan, emphasizing practical ethics and a holistic view of life that included health, education, and deep connection to the natural world.',
      'Ogyū Sorai (1666-1728)': 'Advocated for a return to ancient Confucian texts and emphasized practical governance and social order, rejecting moralistic interpretations of Neo-Confucianism.',
      'Andō Shōeki (1703-1762)': 'Advocated for a natural, egalitarian society based on "Right Cultivation," rejecting the artificial hierarchies and exploitative systems of established social orders.',
      'Miura Baien (1723-1789)': 'Developed a unique philosophical system emphasizing logical analysis and investigation of natural principles, contributing to early modern Japanese scientific and philosophical thought.',
      'Motoori Norinaga (1730-1801)': 'Emphasized the unique essence of Japanese culture, focusing on "mono no aware" (sensitivity to the pathos of things) and advocating for study of ancient Japanese texts, free from foreign influences.',
      'Late Modern Western Philosophy (19th c)': 'The era of German Idealism, Utilitarianism, Marxism, Existentialism, and early psychology — fundamentally reshaping Western thought.',
      'German Idealism (1780\'s - 1840s)': 'Asserts that reality is fundamentally mental, and that the mind plays an active and constitutive role in shaping our experience of the world.',
      'Immanuel Kant (1724-1804)': 'Sought to reconcile rationalism and empiricism through his "critical philosophy," arguing that knowledge is shaped by both experience and innate mental structures, and advocating the categorical imperative.',
      'Johann Gottlieb Fichte (1762-1814)': 'Centers on the "I" as the fundamental principle, asserting that self-consciousness actively posits itself and the non-self, aiming to establish a system of freedom.',
      'Georg Wilhelm Friedrich Hegel (1770-1831)': 'Posits that reality is fundamentally historical and rational, unfolding through a dialectical process of thesis, antithesis, and synthesis, culminating in the absolute realization of spirit.',
      'Friedrich Hölderlin (1770-1843)': 'Sought to fuse classical Greek ideals with German Romanticism, exploring themes of nature, divinity, and the human condition through intensely lyrical poetry.',
      'Friedrich Wilhelm Joseph Schelling (1775-1854)': 'Sought to unify nature and spirit, exploring the dynamic interplay between them and the evolution of the Absolute through a process of unfolding identity.',
      'Utilitarianism (18th c - present)': 'The morally right action is the one that produces the greatest balance of happiness over suffering for the greatest number of people.',
      'Jeremy Bentham (1748-1832)': 'Advocated utilitarianism, the principle that actions are right if they promote the greatest happiness for the greatest number, and invented the hedonic calculus.',
      'John Stuart Mill (1806-1873)': 'Refined utilitarianism, emphasizing the quality of happiness and advocating for individual liberty and social progress, with the "harm principle" defining limits of societal interference.',
      'Henry Sidgwick (1838-1900)': 'Sought to provide a rigorous and systematic analysis of moral reasoning, aiming to reconcile intuitionism, egoism, and utilitarianism.',
      'R.M. Hare (1919-2002)': 'Developed prescriptivism, a meta-ethical theory asserting that moral judgments are essentially universalizable prescriptions, not descriptions of facts.',
      'Peter Singer (1946-present)': 'Advocates for utilitarianism focusing on preventing suffering and promoting well-being, particularly for sentient beings, with influential work on animal rights and effective altruism.',
      'Anthropological Materialism (19th c)': 'Asserts that material conditions, particularly those related to survival and production, fundamentally shape human culture and social structures.',
      'Ludwig Feuerbach (1804-1872)': 'Argued that God is a human projection, and thus humans should focus on their own material existence and the importance of human relationships.',
      'Marxism (1818-present)': 'A critique of the exploitative nature of capitalism and a call for revolutionary transformation of society to create a more just and equitable world.',
      'Karl Marx (1818-1883)': 'Centers on the idea that history is driven by class struggles arising from economic systems, and that capitalism will be overthrown by the proletariat, leading to a classless, communist society.',
      'Friedrich Engels (1820-1895)': 'Collaborating closely with Karl Marx, co-developed Marxist theory, applying materialist analysis to history and economics, and advocating for a classless, communist society.',
      'Vladimir Lenin (1870-1924)': 'Advocated for a revolutionary vanguard party to lead the proletariat in overthrowing capitalism and establishing a dictatorship of the proletariat as a transitional phase toward communism.',
      'Rosa Luxemburg (1871-1919)': 'A revolutionary Marxist who criticized both capitalist exploitation and the authoritarian tendencies within Leninism, advocating for democratic socialism and mass action by the working class.',
      'Leon Trotsky (1879-1940)': 'Advocated for "permanent revolution," arguing that socialist revolutions must spread internationally to succeed, and criticized Stalin\'s bureaucratic control of the Soviet Union.',
      'Antonio Gramsci (1891-1937)': 'Explored "hegemony," arguing that ruling classes maintain power through ideological control as well as force, and emphasized the importance of building counter-hegemony.',
      'Mao Zedong (1893-1976)': 'Adapted Marxism-Leninism to agrarian China, emphasizing peasant-led revolution, continuous class struggle, and the importance of ideological purity.',
      'Pessimism (19th c)': 'Asserts that life is inherently filled with suffering, meaninglessness, and struggle, emphasizing the inevitability of human discontent and the futility of striving for lasting happiness.',
      'Arthur Schopenhauer (1788-1860)': 'Asserts that the will is the fundamental force driving all existence, leading to inevitable suffering, and that peace can only be achieved through renunciation of desires.',
      'Transcendentalism (1830s-1860s)': 'An American philosophical and literary movement emphasizing the inherent goodness of people and nature, individual intuition, and the importance of self-reliance over institutional authority.',
      'Henry David Thoreau (1817-1862)': 'Advocates for simplicity, self-reliance, and deep connection to nature, emphasizing individual conscience, civil disobedience, and living authentically in alignment with one\'s values.',
      'Existentialism (19th c - present)': 'A call to embrace freedom, responsibility, and authenticity in a world without inherent meaning, and to create one\'s own essence through conscious choices.',
      'Søren Kierkegaard (1813-1855)': 'Emphasized the importance of individual subjectivity, the leap of faith, and the existential experience of anxiety and despair in the face of life\'s fundamental choices.',
      'Friedrich Nietzsche (1844-1900)': 'Challenges traditional morality and religion, advocating for the "will to power" and the creation of new values in a world where "God is dead."',
      'Karl Jaspers (1883-1969)': 'Centers on existential communication and exploration of "limit situations" to achieve authentic selfhood, emphasizing individual freedom and responsibility amid uncertainty.',
      'Gabriel Marcel (1889-1973)': 'Emphasizes the importance of "being" over "having," focusing on intersubjectivity, fidelity, and the experience of mystery in human existence.',
      'Martin Heidegger (1889-1976)': 'Explores the meaning of "Being," emphasizing the importance of "Dasein" (human existence) and its engagement with time, authenticity, and what it means to exist.',
      'Jean-Paul Sartre (1905-1980)': 'Asserts that "existence precedes essence," emphasizing individual freedom and responsibility in a meaningless universe, where humans must create their own values and meaning.',
      'Simone de Beauvoir (1908-1986)': 'Existentialist feminism argues "one is not born, but rather becomes, a woman," emphasizing the social construction of gender and advocating for women\'s liberation.',
      'Absurdism (20th c)': 'The belief that life is inherently meaningless, and while humans seek meaning, the universe offers none — a conflict to be confronted by embracing the absurd and living authentically despite it.',
      'Albert Camus (1913-1960)': 'Explores the absurdity of the human condition and the search for meaning in a meaningless universe, advocating for rebellion and acceptance of life\'s inherent contradictions.',
      'Depth Psychology/Analytical Psychology/Psychology of Religion (1880-1970)': 'Explores the unconscious dimensions of human experience, including the dynamics of the psyche, archetypes, and the psychological basis of religious and spiritual experience.',
      'Sigmund Freud (1856-1939)': 'Developed psychoanalysis, a theory of personality and method of psychotherapy, emphasizing the unconscious mind, childhood experiences, and the influence of sexual and aggressive drives.',
      'Alfred Adler (1870-1937)': 'Developed individual psychology, emphasizing the importance of social factors, feelings of inferiority, and the drive for superiority in shaping personality and behavior.',
      'Carl Jung (1875-1961)': 'Developed analytical psychology, focusing on the collective unconscious, archetypes, and the process of individuation, emphasizing integration of conscious and unconscious aspects of the psyche.',
      'Ludwig Binswanger (1881-1966)': 'Developed existential psychoanalysis (Daseinsanalyse), applying Heidegger\'s philosophy to psychiatry, emphasizing the individual\'s experience of "being-in-the-world."',
      'Melanie Klein (1882-1960)': 'Developed object relations theory, emphasizing the importance of early childhood relationships and internal mental representations in shaping personality development.',
      'Otto Rank (1884-1939)': 'Emphasized the trauma of birth as a foundational psychological experience, the importance of individual will and creativity, and the therapeutic relationship as a space for growth.',
      'Modern Indian Philosophy (19th c - 21st c)': 'Seeks to provide a framework for meaningful life, integrating spiritual wisdom with contemporary challenges and engaging with both Indian tradition and Western thought.',
      'Raja Ram Mohan Roy (1772-1833)': 'Advocated for monotheism, the abolition of sati (widow burning), and modern education, considered a key figure in the Bengal Renaissance.',
      'Rabindranath Tagore (1861-1941)': 'A multifaceted Indian polymath known for his poetry, philosophy, and social reform, who emphasized the interconnectedness of humanity and nature, advocating for universalism and spiritual harmony.',
      'Swami Vivekananda (1863-1902)': 'A Hindu monk and philosopher who introduced Vedanta and Yoga to the Western world, advocating for religious tolerance, social reform, and the realization of the divine within all beings.',
      'Mahatma Gandhi (1869-1948)': 'Rooted in Hinduism, emphasized nonviolent resistance (satyagraha), self-rule (swaraj), and social reform, advocating for simple living, religious tolerance, and upliftment of the marginalized.',
      'Sri Aurobindo (1872-1950)': 'Developed Integral Yoga, aiming to integrate the material and spiritual dimensions of human existence, advocating for the evolution of human consciousness toward a divine life on earth.',
      'Sarvepalli Radhakrishnan (1888-1975)': 'An Indian philosopher and statesman who emphasized the importance of Eastern spiritual traditions in a modern world, advocating for a synthesis of Eastern and Western thought.',
      'Dr. B.R. Ambedkar (1891-1956)': 'Emphasized social justice, eradication of caste discrimination, and promotion of human rights, advocating for equality and the empowerment of marginalized communities in India.',
      'Jiddu Krishnamurti (1895-1986)': 'Centered on inner freedom, advocating for self-awareness, questioning of authority and tradition, and liberation from psychological conditioning to achieve true personal transformation.',
      'Modern Japanese Philosophy (19th c - 21st c)': 'Explores the nature of existence, ethics, and aesthetics, emphasizing harmony, interconnectedness, and meaning in everyday life, blending Western and Japanese traditions.',
      'Nishi Amane (1829-1897)': 'Known for integrating Western philosophy with Japanese thought, focusing on civilization and the importance of individuality, self-development, and Japan embracing modernity.',
      'Katō Hiroyuki (1836-1916)': 'Advocated for Western-style modernization and legal reform, emphasizing Social Darwinism and the necessity of a strong centralized state to ensure national survival.',
      'Nakae Chōmin (1847-1901)': 'Political philosopher who championed democracy and individual rights, blending Rousseau\'s ideas with Eastern thought to advocate for constitutional government and freedom in Meiji-era Japan.',
      'Kitarō Nishida (1870-1945)': 'Founded the Kyoto School, developing a unique blend of Western philosophy and Zen Buddhism, emphasizing "pure experience" as the foundation of reality and knowledge.',
      'Hajime Tanabe (1885-1962)': 'A key figure of the Kyoto School, developed the philosophy of "metanoetics," emphasizing self-negation and repentance as means of transcending human limitations.',
      'Watsuji Tetsurō (1889-1960)': 'Explored the interplay between individual and society, developing "fūdo" (climate and culture) to show how human existence is shaped by historical and environmental contexts.',
      'Keiji Nishitani (1900-1990)': 'Kyoto School philosopher who explored "nothingness" (kū) through Buddhist and existentialist lenses, arguing that overcoming nihilism requires direct experience of emptiness.',
      'Modern Chinese Philosophy (20th c - 21st c)': 'Makes efforts to forge a unique path integrating China\'s rich intellectual heritage with the demands of a rapidly changing world.',
      'Kang Youwei (1858-1927)': 'Reformist thinker who advocated for Confucian modernism, proposing a constitutional monarchy and social welfare based on his utopian vision of a globally unified society.',
      'Cai Yuanpei (1868-1940)': 'Promoted academic freedom, intellectual pluralism, and modern education reform, emphasizing independent thought and aesthetic education in shaping a progressive society.',
      'Liang Qichao (1873-1929)': 'Championed modernization, advocating for political and social reforms including constitutionalism, education, and national unity while promoting cultural rejuvenation.',
      'Xiong Shili (1885-1968)': 'Developed the "New Confucian" school, emphasizing integration of Confucianism with Buddhist and Daoist ideas, focusing on "Li" (principle) as the fundamental reality.',
      'Hu Shi (1891-1962)': 'Advocated for vernacular Chinese in literature and education, promoting pragmatism, scientific thinking, and modernization while seeking to reform traditional Chinese culture.',
      'Feng Youlan (1895-1990)': 'Played a key role in modernizing Chinese philosophy, synthesizing traditional thought with Western philosophy, and advocating for a practical, human-centered approach to Confucianism.',
      'Mou Zongsan (1909-1995)': 'Synthesized Confucianism with Western existentialism and phenomenology, focusing on moral consciousness and the role of human agency in shaping reality.',
      'Li Zehou (1930-present)': 'Integrating Marxism with traditional Chinese thought, emphasizing the importance of aesthetic experience and human creativity in shaping history.',
      'Modern Islamic Philosophy (20th c - 21st c)': 'A dynamic field seeking to provide a relevant and meaningful framework for living a life of faith and reason in the modern world.',
      'Jamal al-Din al-Afghani (~1838-1897)': 'Promoted pan-Islamism, advocating for unity of Muslim nations to resist Western imperialism and calling for modernization and reform while emphasizing rationality within Islamic thought.',
      'Muhammad Abduh (1849-1905)': 'Sought to reconcile Islam with modernity, advocating for rationalism, educational reform, and reinterpretation of Islamic texts to promote social justice and religious tolerance.',
      'Muhammad Iqbal (1877-1938)': 'Promoted self-empowerment and spiritual awakening in Islam, advocating for revival of Islamic thought through intellectualism, emphasizing individual freedom, and envisioning a separate Muslim state.',
      'Sayyid Qutb (1906-1966)': 'Argued for establishment of an Islamic state governed by Sharia law, advocating for a radical reinterpretation emphasizing social justice, anti-colonialism, and rejection of Western materialism.',
      'Fazlur Rahman (1919-1988)': 'Sought to modernize Islamic thought, advocating for a contextual interpretation of the Quran, emphasizing reason and historical understanding while promoting social justice.',
      'Mohammad Arkoun (1928-2010)': 'Advocated for a critical, intellectual approach to Islamic thought, emphasizing the need to rethink traditional interpretations through modern philosophy, rationalism, and human sciences.',
      'Ali Shariati (1933-1977)': 'Combined Marxism with Islamic thought, advocating for social justice, anti-imperialism, and the empowerment of the oppressed through an active interpretation of Islam.',
      'Modern African Philosophy (20th c - 21st c)': 'A vibrant and evolving field seeking to articulate African perspectives, address the challenges facing the continent, and contribute to global philosophical discourse.',
      'Kwasi Wiredu (1931-2022)': 'Advocating for critical examination of African traditions through reason, promoting conceptual decolonization and synthesis of African and Western thought in ethics, epistemology, and political philosophy.',
      'Sophie Oluwole (1935-2018)': 'Emphasized the importance of oral traditions, indigenous knowledge systems, and the philosophical contributions of African cultures to global philosophical discourse.',
      'V. Y. Mudimbe (1941-present)': 'Explored the intersections of African thought and colonialism, critically examining how colonialism shaped African identities and advocating for reclamation of African philosophy.',
      'Paulin J. Hountondji (1942-present)': 'Known for critique of ethnophilosophy and advocacy for a more rigorous, scientific approach to African philosophy, emphasizing reason and critical thinking.',
      'Kwame Anthony Appiah (1954-present)': 'Known for work on ethics, identity, and cosmopolitanism, arguing for a global sense of moral responsibility that transcends cultural boundaries while respecting cultural diversity.',
      'Contemporary Western Philosophy (19th c - 21st c)': 'The diverse landscape of 20th and 21st century Western philosophy, encompassing pragmatism, analytic philosophy, continental philosophy, and emerging syntheses.',
      'Pragmatism (1870s - present)': 'Focuses on the practical implications of beliefs, valuing ideas that contribute to well-being and the betterment of society, prioritizing action, experience, and ongoing pursuit of solutions.',
      'Charles Sanders Peirce (1839-1914)': 'Considered the father of pragmatism, emphasizing that the meaning of concepts is rooted in their practical effects, and developing a theory of knowledge based on inquiry and signs.',
      'Oliver Wendell Holmes Jr. (1841-1935)': 'Contributed to American legal realism, emphasizing that law should be interpreted based on practical consequences and evolving societal values rather than rigid formalism.',
      'William James (1842-1910)': 'Promoted pragmatism and radical empiricism, arguing that the truth of ideas is determined by their practical impact on human experience and ability to solve problems.',
      'John Dewey (1859-1952)': 'Argued that knowledge is grounded in experience and that learning should be active and problem-solving, aiming to improve society through democratic participation and social reform.',
      'George Herbert Mead (1863-1931)': 'Developed the theory of social behaviorism, emphasizing that the self emerges through social interaction and that meaning is constructed through language and community.',
      'Analytic Philosophy (1900s - present)': 'Commitment to clarity, rigor, and logical analysis, seeking to clarify philosophical problems by carefully examining language and concepts and constructing arguments with precision.',
      'Gottlob Frege (1848-1925)': 'Considered the father of modern logic and analytic philosophy, arguing that language\'s structure reflects the logic of thought, and developing theories of sense and reference.',
      'Alfred North Whitehead (1861-1947)': 'British mathematician and philosopher who co-authored Principia Mathematica with Russell and later developed process philosophy, arguing that dynamic processes rather than static substances are the fundamental constituents of reality.',
      'Bertrand Russell (1872-1970)': 'Contributed to analytic philosophy and logical positivism, advocating for a scientific and logical approach to understanding the world, emphasizing clarity in language and logic.',
      'G. E. Moore (1873-1958)': 'Known for defense of common sense and work in analytic philosophy, particularly his argument against idealism and emphasis on the existence of objective reality.',
      'Ludwig Wittgenstein (1889-1951)': 'Revolutionized philosophy of language, asserting that the meaning of words is shaped by their use in everyday language, and arguing that philosophical problems arise from misunderstandings of language.',
      'Rudolf Carnap (1891-1970)': 'Logical positivism asserts that only verifiable statements are meaningful, advocating for a scientific approach to philosophy through formal logic.',
      'Willard Van Orman Quine (1908-2000)': 'Advocated for a holistic view of knowledge, emphasizing the interconnectedness of all beliefs and rejecting the analytic-synthetic distinction.',
      'Saul Kripke (1940-2022)': 'Significantly reshaped analytic philosophy by establishing that necessity is a metaphysical notion distinct from apriority, and that proper names are rigid designators.',
      'Contemporary Political Philosophy (19th c - 21st c)': 'Grapples with modern challenges to traditional political thought, addressing justice, rights, power, and governance in a rapidly changing world.',
      'American Political Philosophy (20th c)': 'The distinctly American contributions to political philosophy, addressing democracy, justice, rights, and liberalism in the 20th century.',
      'Walter Lippmann (1889-1974)': 'Analyzed the discrepancy between real-world complexities and public simplified perceptions, emphasizing media influence and the need for expert-informed governance in modern democracy.',
      'John Rawls (1921-2002)': 'Advocates for a just society structured by principles of fairness and equality, determined through a hypothetical "original position" behind a "veil of ignorance."',
      'Libertarianism (20th c - 21st c)': 'Advocates for individual liberty, minimal government intervention, and free-market principles, emphasizing individual rights and autonomy against state power.',
      'Robert Nozick (1938-2002)': 'Advocates for a minimal state, emphasizing individual rights and property rights, and rejecting redistributive taxation as unjust.',
      'Hannah Arendt (1906-1975)': 'Centers on the nature of power, totalitarianism, and human freedom, emphasizing political action, public discourse, and the dangers of thoughtlessness in enabling oppression.',
      'Leo Strauss (1899-1973)': 'Advocates for a return to classical political thought to critique modern liberalism and rediscover enduring truths about natural right, often through esoteric interpretations of ancient texts.',
      'Political Realism (20th c - 21st c)': 'The view that politics and international relations are governed by power and self-interest rather than ideals or moral principles.',
      'Authoritarian Political Realism/Decisionism (20th c)': 'A form of political realism emphasizing the sovereign\'s power to decide in exceptional circumstances, defining politics through conflict rather than consensus.',
      'Carl Schmitt (1888-1985)': 'Centers on the sovereign\'s absolute power to decide on the exception, defining the political through the "friend-enemy" distinction, and critiquing liberal legalism.',
      'Continental Philosophy (1920s - present)': 'Critical engagement with history, culture, and experience, seeking to understand the complexities of human existence and challenge dominant assumptions about the world.',
      'Phenomenology (19th c - present)': 'Seeks to understand the structures of consciousness and the phenomena that appear within it, by examining lived experience from a first-person perspective.',
      'Edmund Husserl (1859-1938)': 'Sought to understand the essential structures of consciousness and experience by suspending assumptions about the external world, founding phenomenology as a rigorous philosophical method.',
      'Hans-Georg Gadamer (1900-2002)': 'Emphasized the importance of historical context and dialogue in understanding and interpreting texts and experiences, developing philosophical hermeneutics.',
      'Critical Theory (1920s-present)': 'A project of social critique seeking to understand and challenge the forces that perpetuate inequality and oppression, with the goal of creating a more just and liberated society.',
      'The Frankfurt School (1923 - present)': 'A group of German philosophers and social theorists who combined Marxist analysis with psychoanalysis and cultural criticism to critique modern capitalist society.',
      'Walter Benjamin (1892-1940)': 'Explored the interplay of history, culture, and technology, emphasizing the "aura" of art and the potential for revolutionary moments within historical ruins.',
      'Max Horkheimer (1895-1973)': 'Developed critical theory to critique societal structures arising from capitalism and instrumental reason, aiming to reveal and challenge forms of domination.',
      'Herbert Marcuse (1898-1979)': 'Critiqued advanced industrial society, arguing that it creates "one-dimensional" individuals through the manipulation of needs and suppression of critical thought.',
      'Theodor W. Adorno (1903-1969)': 'Dissected the culture industry and modern society, emphasizing the dialectic of enlightenment and the pervasive nature of domination.',
      'Jürgen Habermas (1929-present)': 'Centers on communicative rationality, emphasizing the potential for achieving mutual understanding and consensus through open, rational discourse.',
      'Erich Fromm (1900-1980)': 'Blended psychoanalysis with humanist Marxism, exploring the psychological roots of social and political behavior, advocating for a society fostering human freedom, love, and self-realization.',
      'Slavoj Žižek (1949-present)': 'Applies Lacanian psychoanalysis, Hegelian philosophy, and Marxist critique to analyze contemporary culture and ideology, revealing underlying contradictions.',
      'Postmodernism (1960-present)': 'Challenges the assumptions of modernity, emphasizing the instability of meaning, the importance of context, and the constructed nature of reality.',
      'Jean-François Lyotard (1924-1998)': 'Explored postmodernism, emphasizing the breakdown of grand narratives and the importance of localized "language games."',
      'Jean Baudrillard (1929-2007)': 'Critiqued consumer culture and the hyperreal, arguing that simulations and images have replaced reality, leading to a loss of meaning.',
      'Félix Guattari (1930-1992)': 'Often collaborating with Gilles Deleuze, explored schizoanalysis and transversalism, advocating for a deterritorialized and fluid approach to subjectivity and social organization.',
      'Richard Rorty (1931-2007)': 'Rejected traditional philosophical foundations, advocating for a focus on social solidarity and practical problem-solving through conversation and narrative.',
      'Post-structuralism (1960s-present)': 'Dismantles the idea of fixed meanings, stable structures, and unified subjects, emphasizing the fluidity, instability, and power-laden nature of language and reality.',
      'Jacques Lacan (1901-1981)': 'Explores how language and symbolic structures shape human subjectivity and desire, revealing the inherent instability and lack within the individual\'s experience of reality.',
      'Roland Barthes (1915-1980)': 'Explored the semiotics of culture, analyzing how signs and symbols shape meaning in everyday life and literature, revealing the constructed nature of reality.',
      'Gilles Deleuze (1925-1995)': 'Often collaborating with Félix Guattari, developed concepts like "desiring-production," "the rhizome," and "becoming," challenging traditional notions of identity and structure.',
      'Michel Foucault (1926-1984)': 'Examined the relationship between power, knowledge, and discourse, revealing how social norms and institutions shape subjectivity and control.',
      'Jacques Derrida (1930-2004)': 'His philosophy of deconstruction explored the instability of meaning in language and texts, revealing how binary oppositions and hierarchies undermine claims to absolute truth.',
      'Julia Kristeva (1941-present)': 'Explores the intersection of language, psychoanalysis, and feminism, particularly focusing on the "semiotic" and the "symbolic" to analyze subjectivity and social structures.',
      'Cognitive Philosophical Synthesis (1980s - present)': 'Emerging interdisciplinary approaches integrating cognitive science, philosophy, and psychology to understand mind, meaning, and human flourishing.',
      'Cognitive Existentialism (1990s - present)': 'An approach integrating cognitive science with existentialist themes of meaning, authenticity, and human experience.',
      'Cognitive Integration and Meaning-Making (1990s - present)': 'Humans actively work to integrate their experiences and construct meaning, a process vital for psychological health and sense of purpose.',
      'John Vervaeke': 'Focuses on the cognitive science of wisdom, integrating various disciplines to understand how meaning-making and cognitive processes interact.',
      // Metaphilosophy
      'Metaphilosophy': 'The investigation into the fundamental nature, aims, boundaries, and methods of philosophy itself.',
      'Experimental Philosophy/x-phi': 'A contemporary movement that uses empirical methods, typically from psychology, to investigate traditional philosophical questions and the intuitions that inform them.',
      'Negative Program': 'Aims to undermine the traditional reliance on philosophical intuitions by demonstrating their unreliability, biases, or variability through empirical research.',
      'Intuition Variability': 'The empirical finding that philosophical intuitions often differ significantly across diverse demographic groups or even within the same person under varying circumstances.',
      'Philosophical Quietism': 'The view that philosophy should not construct theories or doctrines but instead dissolve philosophical problems by clarifying the misuse of language.',
      'Wittgenstein\'s Philosophical Quietism': 'Wittgenstein\'s view that philosophical problems arise from linguistic misunderstandings and should be therapeutically dissolved rather than theoretically solved.',
      'Philosophy of Logic': 'The examination of the foundations, nature, and validity of logical systems and reasoning.',
      'Philosophy of Language': 'The study of the nature of language, meaning, reference, and communication.',
      'Philosophy of Science': 'The examination of the methods, assumptions, and implications of scientific inquiry.',
      // Political Philosophy additions
      'Democracy': 'A system of government based on popular sovereignty and equal political participation.',
      'Authoritarianism': 'Political systems characterized by concentrated power and limited individual freedoms.',
      'Anarchism': 'The political philosophy advocating for the abolition of hierarchical authority and the state.',
      // Religious Studies (New major section)
      'Religious Studies': 'The academic study of religion, religious beliefs, practices, institutions, and their cultural significance.',
      'Western Religions': 'The major monotheistic faiths originating in the Middle East, including Christianity, Judaism, and Islam.',
      'Christianity': 'The world\'s largest religion based on the life and teachings of Jesus Christ.',
      'Catholicism': 'The largest Christian denomination centered on papal authority and apostolic succession.',
      'Protestantism': 'Christian denominations originating from the 16th century Reformation emphasizing scripture and personal faith.',
      'Orthodox Christianity': 'Eastern Christian churches emphasizing apostolic tradition, sacramental theology, and liturgical worship.',
      'Christian Theology': 'The systematic study of Christian doctrine, God\'s nature, and salvation history.',
      'Christian History': 'The chronological study of Christianity\'s development from its origins through the present day.',
      'Judaism': 'The ancient monotheistic religion based on the Torah and Jewish law and tradition.',
      'Jewish Law': 'The system of religious and civil law in Judaism, derived from the Torah and rabbinic interpretation.',
      'Jewish Philosophy': 'The philosophical thought developing from Jewish theological and ethical traditions.',
      'Jewish History': 'The history of the Jewish people, their migrations, persecution, and cultural developments.',
      'Kabbalah': 'The esoteric tradition within Judaism focusing on hidden divine knowledge and mystical interpretation.',
      'Islam': 'The world\'s second-largest religion based on the teachings of Muhammad and the Qur\'an.',
      'Islamic Law': 'The legal system derived from the Qur\'an, Hadith, and scholarly consensus in Islamic societies.',
      'Islamic Theology': 'The systematic exposition of Islamic beliefs regarding Allah, revelation, and human destiny.',
      'Islamic Philosophy': 'The philosophical synthesis of Greek philosophy with Islamic theology and ethics.',
      'Islamic History': 'The history of Islam from the 7th century through contemporary Muslim-majority societies.',
      'Qur\'anic Studies': 'The scholarly examination of the Qur\'an\'s text, interpretation, and historical context.',
      'Eastern Religions': 'The major religious traditions originating in Asia, encompassing Dharmic/Indic traditions and East Asian religions.',
      'Dharmic/Indic Religions': 'A family of Indian spiritual traditions centered on the concept of Dharma—a universal law of cosmic order and duty—and the pursuit of Moksha or Nirvana to achieve liberation from the cycle of birth and rebirth.',
      'East Asian Religions': 'Traditions emphasizing the cultivation of social and cosmic harmony through the balance of opposing forces, the veneration of ancestors, and a deep alignment with the natural order.',
      'Buddhism': 'The spiritual tradition founded on the teachings of Buddha emphasizing the elimination of suffering.',
      'Theravada': 'The oldest Buddhist school emphasizing individual enlightenment through meditation and monastic practice.',
      'Mahayana': 'The major Buddhist tradition emphasizing universal enlightenment and the role of bodhisattvas.',
      'Zen Buddhism': 'A Mahayana tradition that pursues direct awakening to one\'s Buddha-nature through zazen (seated meditation), mindfulness, and the recognition that all phenomena are empty of inherent existence — favoring lived experience over doctrine.',
      'Vajrayana': 'The Buddhist school emphasizing tantric practices and visualization for rapid enlightenment.',
      'Buddhist Philosophy': 'The philosophical teachings of Buddhism regarding the nature of self, suffering, and enlightenment.',
      'Buddhist History': 'The development and spread of Buddhism across Asia from the 5th century BC to the present.',
      'Hinduism': 'The major Indian religion with diverse practices centered on dharma, karma, and ultimate liberation.',
      'Vedanta': 'The Hindu philosophical school emphasizing the unity of Brahman and pursuing spiritual liberation.',
      'Yoga': 'Hindu spiritual and physical practices aimed at union with the divine and enlightenment.',
      'Hindu Mythology': 'The stories of Hindu gods, heroes, and cosmic principles in the Vedas and Puranas.',
      'Hindu Philosophy': 'The systematic philosophical traditions within Hinduism exploring ultimate reality and human purpose.',
      'Hindu History': 'The history of Hindu civilization from the Vedic period through contemporary India.',
      'Taoism': 'The Chinese philosophical and religious tradition emphasizing harmony with the Way (Tao) of nature.',
      'Shinto': 'The indigenous Japanese religious tradition focused on kami (spirits) and harmonic relationships with nature.',
      'Sikhism': 'The Indian monotheistic religion founded by Guru Nanak emphasizing social equality and devotion to God.',
      'Jainism': 'The Indian religion emphasizing non-violence, asceticism, and liberation through spiritual discipline.',
      'Vietnamese Folk Religion': 'A syncretic tradition blending animism, ancestor veneration, mother goddess worship (Mẫu), and village deity cults with the "Three Teachings" of Buddhism, Taoism, and Confucianism — giving rise to modern movements like Cao Dai and Hoa Hao.',
      'Biblical Studies': 'The scholarly examination of the Hebrew Bible and New Testament, including their history and interpretation.',
      'Old Testament/Hebrew Bible (Tanakh)': 'A collection of writings detailing God\'s creation, His covenant with Israel, the history of the patriarchs and prophets, law, psalms, and wisdom literature — all anticipating a coming Messiah.',
      'The Pentateuch (The Law/Torah)': 'The five books of Moses — Genesis, Exodus, Leviticus, Numbers, and Deuteronomy — narrating creation, Israel\'s origins, the Exodus, and the covenant laws given at Sinai.',
      'Genesis': 'Provides the foundational narrative for understanding the relationship between God, humanity, and the world, setting the stage for the rest of the biblical story.',
      '1–2:3 (The Seven Days of Creation)': 'God systematically creates the heavens, the earth, and all life over six days, resting on the seventh to sanctify it.',
      '1:1–2 (The Initial State)': 'The narrative opens with the creation of the heavens and the earth, describing a dark, formless void over which the Spirit of God hovers.',
      '1:3–5 (Day One: Light)': 'God speaks light into existence and separates it from the darkness, establishing the first cycle of evening and morning.',
      '1:6–8 (Day Two: The Expanse)': 'A canopy is created to separate the waters below from the waters above, forming the sky.',
      '1:9–13 (Day Three: Land and Vegetation)': 'God gathers the waters to reveal dry land and commands the earth to sprout plants and fruit-bearing trees according to their kinds.',
      '1 (Day Four: Luminaries)': 'The sun, moon, and stars are placed in the heavens to govern the day and night and to serve as signs for seasons, days, and years.',
      '1 (Day Five: Sea and Sky Life)': 'The waters are filled with living creatures and the sky with winged birds, each blessed to be fruitful and multiply.',
      '1:24–31 (Day Six: Land Animals and Humanity)': 'God creates land animals followed by the climax of creation: mankind, made in the divine image to rule over the earth and its inhabitants.',
      '2:1–3 (Day Seven: The Divine Rest)': 'Having completed the work of creation, God rests from His labors and blesses the seventh day, setting it apart as holy.',
      '2:4–3 (The Garden of Eden and the Fall)': 'God forms humanity and places them in a paradise, but they are exiled after disobeying his command by eating from the Tree of Knowledge.',
      '2:4–17 (The Creation of Man and the Garden)': 'God forms man from the dust, breathes life into him, and places him in the Garden of Eden with the command not to eat from the Tree of Knowledge of Good and Evil.',
      '2:18–25 (The Creation of Woman)': 'After Adam finds no suitable helper among the animals, God fashions a woman from his rib, establishing the first marriage covenant.',
      '3:1–7 (The Temptation and Fall)': 'The serpent deceives the woman into eating the forbidden fruit, she shares it with Adam, and their eyes are opened to their nakedness.',
      '3:8–13 (God Confronts the Couple)': 'Hearing God in the garden, the couple hides in shame, leading to a confrontation where Adam blames the woman and the woman blames the serpent.',
      '3:14–19 (The Curses and Consequences)': 'God pronounces judgments on the serpent, the woman\'s childbearing, and the man\'s labor, decreeing that humanity will return to the dust.',
      '3:20–24 (Expulsion from Eden)': 'After clothing the couple in animal skins, God banishes them from the garden and stations cherubim with a flaming sword to guard the Tree of Life.',
      '4 (Cain and Abel)': 'Jealousy leads Cain to murder his brother Abel, resulting in Cain\'s wandering and the further proliferation of human lineage.',
      '5 (The Generations of Adam)': 'This genealogical record traces the line from Adam to Noah, emphasizing the progression of life and the inevitability of death.',
      '6–9 (The Great Flood and Noahic Covenant)': 'God purges the earth\'s corruption through a global flood but preserves Noah\'s family and animal life, establishing a covenant never to destroy the earth by water again.',
      '10–11:9 (The Table of Nations and Tower of Babel)': 'Humanity spreads across the earth after God halts the construction of a rebellious tower by confusing their shared language.',
      '11:10–25:11 (The Abrahamic Cycle)': 'God calls Abraham to journey to Canaan and establishes a covenant promising him a great nation through his son Isaac.',
      '11:10–26 (The Lineage of Shem to Terah)': 'The narrative provides the genealogical bridge from the post-flood world to Terah, who moves his family toward Canaan but settles in Haran.',
      '12:1–9 (The Call of Abram)': 'God commands Abram to leave his country for an unknown land, promising to make him a great nation and a blessing to all families of the earth.',
      '12:10–20 (Abram and Sarai in Egypt)': 'During a famine, Abram travels to Egypt and deceptively claims Sarai is his sister, leading to divine plagues on Pharaoh\'s house until they are sent away.',
      '13 (The Separation of Abram and Lot)': 'To resolve conflict between their herdsmen, Abram generously allows Lot to choose the fertile Jordan Valley while he remains in the land of Canaan.',
      '14 (The Rescue of Lot and Melchizedek)': 'After Abram defeats a coalition of kings to rescue his kidnapped nephew, he is blessed by the mysterious priest-king Melchizedek and refuses a reward from the King of Sodom.',
      '15 (The Covenant of the Pieces)': 'God formally establishes a covenant with Abram through a smoking firepot and a flaming torch, promising him a biological heir and a specific geographic territory.',
      '16 (The Birth of Ishmael)': 'At Sarai\'s urging, Abram fathers a child by the Egyptian servant Hagar, leading to domestic conflict and the divine protection of Hagar in the wilderness.',
      '17 (The Covenant of Circumcision)': 'God renames Abram to Abraham, promises that Sarah will bear a son, and institutes circumcision as a physical sign of the perpetual covenant.',
      '18:1–19:38 (The Visitors and the Fate of Sodom)': 'After three visitors promise Sarah a son, Abraham intercedes for Sodom, which is ultimately destroyed while Lot and his daughters escape.',
      '20 (Abraham and Abimelech)': 'Repeating his earlier pattern, Abraham tells King Abimelech that Sarah is his sister, resulting in a divine warning to the king to restore her.',
      '21 (The Birth of Isaac and the Expulsion of Hagar)': 'Sarah gives birth to Isaac in her old age, leading to the final dismissal of Hagar and Ishmael and a treaty between Abraham and Abimelech at Beersheba.',
      '22 (The Binding of Isaac)': 'In the ultimate test of faith, God commands Abraham to sacrifice Isaac on Mount Moriah, intervening at the last moment with a ram provided in the thicket.',
      '23 (The Death and Burial of Sarah)': 'Following Sarah\'s death, Abraham negotiates the purchase of the cave of Machpelah as a permanent family burial site in the land of promise.',
      '24 (A Wife for Isaac)': 'Abraham\'s servant travels to Mesopotamia and successfully identifies Rebekah as the chosen bride for Isaac, bringing her back to Canaan.',
      '25:1–11 (The Death of Abraham)': 'The cycle concludes with Abraham\'s marriage to Keturah, his death at 175 years old, and his burial by Isaac and Ishmael in the cave of Machpelah.',
      '25:12–18 (The Descendants of Ishmael)': 'This brief genealogical record accounts for the twelve tribal leaders descended from Abraham\'s first son.',
      '25:19–36 (The Jacob Narrative)': 'Jacob survives a lifetime of conflict with his brother Esau and his father-in-law Laban to inherit the patriarchal promise.',
      '37–50 (The Story of Joseph)': 'Sold into slavery by his brothers, Joseph rises to power in Egypt and eventually saves his entire family from a regional famine.',
      '37 (Joseph and His Brothers)': 'Jealousy leads the brothers to sell Joseph into slavery and deceive their father with a blood-stained tunic.',
      '38 (Judah and Tamar)': 'A narrative interruption focuses on the lineage of Judah and the clever strategy Tamar uses to secure her rights.',
      '39–40 (Joseph in Egypt and the Prison Dreams)': 'Joseph rises to power in Potiphar\'s house and later interprets the dreams of the cupbearer and baker while imprisoned.',
      '41 (Pharaoh\'s Dreams and Joseph\'s Rise)': 'Joseph interprets Pharaoh\'s dreams of cows and grain, resulting in his promotion to second-in-command over Egypt.',
      '41:1–8 (Pharaoh\'s Troubling Dreams)': 'Two distinct visions of cows and grain leave the ruler of Egypt distressed and his magicians unable to provide an explanation.',
      '41:9–36 (Joseph\'s Interpretation and Counsel)': 'Summoned from prison, Joseph credits God with the meaning of the dreams and proposes a national plan for the coming famine.',
      '41:37–45 (The Promotion of Joseph)': 'Impressed by Joseph\'s wisdom, Pharaoh appoints him as vizier and grants him the symbols of royal authority.',
      '41:46–57 (The Seven Years of Plenty and Famine)': 'Joseph manages the grain surplus during the years of abundance and opens the storehouses when the global drought begins.',
      '42–45 (The Brothers in Egypt and Joseph\'s Revelation)': 'Famine brings the brothers to Egypt for grain, leading to a series of tests before Joseph finally reveals his identity to them.',
      '46–47 (Jacob\'s Migration and Settlement in Goshen)': 'The entire family moves to Egypt and settles in the fertile land of Goshen during the famine.',
      '48–49 (Jacob\'s Blessings and Death)': 'Jacob blesses Joseph\'s sons and delivers prophetic oracles concerning the future of the twelve tribes.',
      '50 (The Burial of Jacob and Joseph\'s Final Days)': 'The family buries Jacob in Canaan, and Joseph reassures his brothers of his forgiveness before his own death.',
      'Exodus': 'God\'s deliverance of Israel from slavery in Egypt, the giving of the Law at Sinai, and the establishment of the covenant.',
      '1 (The Oppression of Israel)': 'A new Pharaoh enslaves the Israelites and orders the killing of their newborn sons to curb their growing population.',
      '2:1–10 (The Birth and Rescue of Moses)': 'A Hebrew woman hides her infant son in a basket on the Nile, where he is discovered and adopted by Pharaoh\'s daughter.',
      '2:11–25 (Moses Flees to Midian)': 'After killing an Egyptian taskmaster to defend a Hebrew, Moses escapes to the desert, marries, and settles as a shepherd.',
      '3–4:17 (The Burning Bush and Call of Moses)': 'God appears to Moses in a miraculous flame, revealing His name as "I AM" and commissioning him to lead Israel out of Egypt.',
      '4:18–7:7 (Moses Returns to Egypt)': 'Moses and his brother Aaron confront Pharaoh with God\'s demand, but the king responds by increasing the Israelites\' labor.',
      '7 (The Ten Plagues of Egypt)': 'God unleashes a series of miraculous disasters upon Egypt to demonstrate His power and compel Pharaoh to release the Israelites.',
      '7:1–13 (Aaron\'s Staff Becomes a Snake)': 'Aaron throws down his staff before Pharaoh and it becomes a snake, but Pharaoh\'s magicians do the same, though Aaron\'s staff swallows theirs.',
      '7:14–25 (The First Plague: Nile to Blood)': 'At God\'s command, Moses strikes the Nile, turning its water into blood, killing the fish and making the river stink throughout Egypt.',
      '7:25–8:15 (The Second Plague: Frogs)': 'Frogs swarm the land of Egypt, entering houses and beds, until Pharaoh begs for relief and the frogs die in heaps.',
      '8:16–19 (The Third Plague: Gnats)': 'Dust is turned into gnats that afflict people and animals, a feat the Egyptian magicians cannot replicate, leading them to call it "the finger of God."',
      '8:20–32 (The Fourth Plague: Flies)': 'Thick swarms of flies invade Egypt while the land of Goshen, where the Israelites live, is spared to show God\'s distinction.',
      '9:1–7 (The Fifth Plague: Livestock Die)': 'A terrible plague strikes the Egyptian livestock in the fields while none belonging to Israel die.',
      '9:8–12 (The Sixth Plague: Boils)': 'Moses tosses soot into the air, and it becomes festering boils on people and animals throughout Egypt, including the magicians.',
      '9:13–35 (The Seventh Plague: Hail)': 'The worst hailstorm in Egypt\'s history strikes down everything in the fields, accompanied by thunder and fire, sparing only Goshen.',
      '10:1–20 (The Eighth Plague: Locusts)': 'A massive swarm of locusts devours every green thing left by the hail, leaving the land of Egypt completely stripped of vegetation.',
      '10:21–29 (The Ninth Plague: Darkness)': 'A darkness that can be felt covers Egypt for three days, but the Israelites have light in their dwellings.',
      '11 (Announcement of the Tenth Plague)': 'Moses warns Pharaoh of the final plague — the death of every firstborn — before the Israelites finally make their departure.',
      '12–13:16 (The Passover and Exodus)': 'Israel observes the first Passover to escape the final plague and finally departs Egypt after four hundred years of dwelling there.',
      '12:1–13 (The Passover Lamb)': 'The Lord instructs each Israelite family to slaughter an unblemished lamb and smear its blood on their doorframes so the plague of death will pass over them.',
      '12:14–20 (The Festival of Unleavened Bread)': 'A permanent ordinance is established for Israel to eat bread without yeast for seven days each year to commemorate their haste in leaving Egypt.',
      '12:21–28 (Instructions to the Elders)': 'Moses summons the elders to explain the Passover ritual, emphasizing that future generations should be taught its meaning as a remembrance of God\'s protection.',
      '12:29–36 (The Tenth Plague and the Exodus)': 'At midnight, the Lord strikes down all the firstborn of Egypt, leading Pharaoh to command the Israelites to leave, and they depart with Egyptian silver and gold.',
      '12:37–42 (The Journey Begins)': 'About six hundred thousand men, besides women and children, travel from Rameses to Sukkoth, marking the end of 430 years in Egypt.',
      '12:43–51 (Passover Restrictions)': 'Specific regulations are given regarding who may eat the Passover meal, requiring circumcision of any foreigner who participates.',
      '13:1–16 (Consecration of the Firstborn)': 'God commands that every firstborn male, human and animal, be set apart as holy to the Lord as a living memorial of the Exodus.',
      '13:17–15:21 (Crossing the Red Sea)': 'God parts the waters to allow Israel to escape Pharaoh\'s pursuing army, which is then destroyed when the sea returns to its place.',
      '15:22–18 (The Wilderness Trek to Sinai)': 'The Israelites journey through the desert, where God provides manna and water while Moses organizes the people\'s leadership.',
      '19–24 (The Covenant and Ten Commandments at Sinai)': 'God descends upon the mountain to deliver the Law and establish a formal covenant relationship with the nation of Israel.',
      '19 (Israel at Mount Sinai)': 'The nation prepares for a divine encounter through ritual purification and witnesses God\'s presence in a thick cloud.',
      '20:1–17 (The Ten Commandments)': 'God speaks the primary moral and ethical foundations of the covenant directly to the assembled people.',
      '20:18–26 (The People\'s Response and Altar Laws)': 'Terrified by the divine presence, the Israelites request Moses to mediate and receive instructions for simple stone altars.',
      '21–23 (The Book of the Covenant)': 'This collection of civil and criminal ordinances applies the Ten Commandments to specific social and judicial situations.',
      '21:1–11 (Laws Concerning Hebrew Servants)': 'Specific regulations ensure the fair treatment and eventual release of Israelites who enter domestic service.',
      '21:12–36 (Laws on Violence and Animal Liability)': 'Detailed penalties address personal injury, homicide, and damages caused by negligent livestock ownership.',
      '22:1–15 (Laws Regarding Property and Theft)': 'Restitution requirements provide a legal framework for theft, agricultural damage, and the loss of borrowed items.',
      '22:16–31 (Social and Religious Statutes)': 'Moral mandates protect the vulnerable while strictly prohibiting sorcery, idolatry, and the charging of interest.',
      '23:1–19 (Justice for All and Annual Feasts)': 'Ethical requirements for honest testimony and kindness to enemies are paired with the calendar for the three major pilgrimage festivals.',
      '23:20–33 (Promises and Instructions for the Conquest)': 'Divine assurance of an angel\'s guidance accompanies warnings to avoid the pagan influences of the inhabitants of Canaan.',
      '24 (The Covenant Ratified)': 'Moses and the elders ascend the mountain for a ceremonial meal and formalize the legal bond through the sprinkling of blood.',
      '25–31 (Instructions for the Tabernacle)': 'God provides Moses with detailed architectural plans for a portable sanctuary and its sacred furnishings.',
      '25:1–9 (Offerings for the Sanctuary)': 'The Lord instructs Moses to collect a voluntary offering of gold, silver, and fine materials from the Israelites to build a sanctuary where He may dwell among them.',
      '25:10–22 (The Ark of the Covenant)': 'God provides specific dimensions for the Ark of acacia wood overlaid with gold, including the Mercy Seat and the two golden Cherubim where He will meet with Moses.',
      '25:23–30 (The Table for Showbread)': 'A table of acacia wood and gold is commissioned to hold the "bread of the Presence" at all times before the Lord.',
      '25:31–40 (The Golden Lampstand)': 'An elaborate seven-branched lampstand is to be hammered out of pure gold to provide light within the sanctuary.',
      '26 (The Tabernacle Structure)': 'Detailed instructions are given for the curtains of fine linen, the goat-hair coverings, the wooden frames, and the veil separating the Holy Place from the Most Holy Place.',
      '27:1–8 (The Altar of Burnt Offering)': 'An altar of acacia wood overlaid with bronze is designed for the outer courtyard where animal sacrifices will be made.',
      '27:9–19 (The Courtyard)': 'The dimensions and hangings for the outer courtyard are established, creating a sacred boundary for the Tabernacle complex.',
      '27:20–21 (Oil for the Lampstand)': 'The Israelites are commanded to bring clear oil of pressed olives so that the lamps may be kept burning regularly from evening to morning.',
      '28 (The Priestly Garments)': 'God describes the sacred garments for Aaron and his sons, including the ephod, breastpiece, and the golden plate inscribed "Holy to the Lord."',
      '29 (Consecration of the Priests)': 'A seven-day ceremony involving sacrifices and anointing with oil is outlined to set Aaron and his sons apart for their service.',
      '30:1–10 (The Altar of Incense)': 'A small golden altar is to be placed in front of the veil for the burning of fragrant incense every morning and evening.',
      '30:11–16 (Atonement Money)': 'Every Israelite is required to pay a half-shekel ransom for their life during the census, which is used for the service of the Tent of Meeting.',
      '30:17–21 (The Bronze Basin)': 'A bronze basin is placed between the Tent of Meeting and the altar for the priests to wash their hands and feet before entering God\'s presence.',
      '30:22–38 (The Anointing Oil and Incense)': 'Specific formulas for the holy anointing oil and the fragrant incense are given, with a strict prohibition against using them for common purposes.',
      '31:1–11 (Bezalel and Oholiab)': 'The Lord calls skilled craftsmen, filling them with the Spirit of God to execute the artistic designs for the Tabernacle and its furniture.',
      '31:12–18 (The Sabbath and the Tablets)': 'God reiterates the importance of the Sabbath as a sign of the covenant and delivers the two tablets of the Testimony to Moses.',
      '32–34 (The Golden Calf and Covenant Renewal)': 'The people fall into idolatry while Moses is on the mountain, leading to divine judgment and a subsequent restoration of the covenant.',
      '35–40 (The Construction and Dedication of the Tabernacle)': 'The Israelites build the sanctuary according to the divine pattern, and God\'s glory descends to fill the completed structure.',
      '35:1–3 (Sabbath Regulations)': 'Moses assembles the congregation to reiterate the command that no work, including lighting a fire, be done on the seventh day.',
      '35:4–29 (Materials and Willing Hearts)': 'The Israelites bring a voluntary offering of precious metals, yarns, and stones, showing a spirit of generosity to provide for the sanctuary.',
      '35:30–36:7 (The Skill of the Craftsmen)': 'Bezalel and Oholiab lead the construction, receiving so many contributions that they eventually have to restrain the people from bringing more.',
      '36:8–38 (Construction of the Tabernacle)': 'The skilled workers create the curtains, coverings, frames, and veils according to the exact specifications previously given to Moses.',
      '37 (Making the Furniture)': 'Bezalel fashions the Ark of the Covenant, the Table of Showbread, the Lampstand, and the Altar of Incense from gold and acacia wood.',
      '38:1–20 (The Bronze Altar and Courtyard)': 'The craftsmen build the altar for burnt offerings and the bronze basin, and then set up the pillars and hangings for the outer courtyard.',
      '38:21–31 (The Inventory of Materials)': 'A detailed accounting is recorded of the gold, silver, and bronze used in the construction, overseen by Ithamar son of Aaron.',
      '39:1–31 (The Priestly Garments)': 'The holy garments for Aaron, including the ephod and the engraved gold plate, are completed exactly as the Lord commanded.',
      '39:32–43 (Moses Inspects the Work)': 'After the craftsmen finish every part of the Tabernacle, Moses inspects the labor and blesses the people for their faithful execution of the plan.',
      '40:1–33 (Setting Up the Tabernacle)': 'On the first day of the first month, Moses raises the Tabernacle, places the furniture inside, and officially inaugurates the worship space.',
      '40:34–38 (The Glory of the Lord)': 'The cloud of God\'s presence covers the Tent of Meeting, and His glory fills the Tabernacle, guiding the Israelites throughout their journeys.',
      'Leviticus': 'How a holy God dwells among an imperfect people, emphasizing the need for purity, atonement, and a covenant relationship.',
      '1–7 (The Laws of Sacrifice)': 'God provides specific instructions for the burnt, grain, peace, sin, and guilt offerings to facilitate atonement and worship.',
      '8–10 (The Consecration and Sin of the Priesthood)': 'Aaron and his sons are ordained as priests, but the deaths of Nadab and Abihu highlight the absolute necessity of following God\'s holy protocols.',
      '11–15 (Laws Regarding Purity and Uncleanness)': 'This section defines clean and unclean animals, as well as ritual purifications for childbirth, skin diseases, and bodily discharges.',
      '16 (The Day of Atonement)': 'God establishes a yearly ritual for the High Priest to cleanse the sanctuary and the people of all their sins through the scapegoat and sacrificial blood.',
      '17–26 (The Holiness Code)': 'This central collection of laws demands ethical and ritual holiness in everyday life, covering sexual morality, social justice, and religious festivals.',
      '17 (The Sanctity of Life and Sacrifice)': 'Proper animal slaughter and the blood prohibition serve to honor the life-force belonging to God.',
      '18–20 (Laws of Sexual and Social Purity)': 'Ethical mandates and behavioral boundaries establish a distinct moral identity for the community.',
      '21–22 (Regulations for Priestly Holiness)': 'High standards of ritual purity and physical integrity ensure the sanctity of the priesthood and the altar.',
      '21:1–9 (Regulations for Ordinary Priests)': 'Priests are forbidden from becoming ritually unclean for the dead except for immediate family and must maintain holiness through their marriages.',
      '21:10–15 (Regulations for the High Priest)': 'The High Priest is held to a stricter standard of purity, forbidden from mourning even for his parents or leaving the sanctuary, and required to marry only a virgin from his own people.',
      '21:16–24 (Physical Requirements for Priests)': 'No descendant of Aaron with a physical blemish or defect may approach the altar to present offerings, though they may still eat the holy food.',
      '22:1–16 (Purity and Holy Offerings)': 'Priests must be ritually clean to handle sacred offerings, and unauthorized persons are strictly prohibited from eating the holy food.',
      '22:17–33 (Acceptable Sacrifices)': 'Any animal offered to the Lord must be without defect, and specific rules govern the age of the animal and the timing of the sacrificial feast.',
      '23–25 (The Sacred Calendar and Land Sabbath)': 'Appointed feasts and the Jubilee year structure time and property around divine sovereignty.',
      '23:1–3 (The Sabbath)': 'Weekly rest serves as the foundation for all sacred time and communal worship.',
      '23:4–44 (The Annual Festivals)': 'Seven specific feasts, including Passover and Tabernacles, commemorate historical events and agricultural cycles.',
      '24:1–9 (The Lamp and the Bread)': 'Perpetual light and weekly showbread symbolize God\'s constant presence and provision within the sanctuary.',
      '24:10–23 (The Law of Blasphemy and Retribution)': 'A specific case of profanity establishes the principle of equal justice for citizens and foreigners alike.',
      '25 (The Sabbatical and Jubilee Years)': 'Periodic rest for the land and the redemption of property ensure social equity and divine ownership of the earth.',
      '25:1–7 (The Sabbatical Year)': 'The land receives a complete rest from cultivation every seventh year to honor God\'s ownership of the soil.',
      '25:8–17 (The Year of Jubilee)': 'A trumpet blast on the Day of Atonement every fifty years heralds the restoration of ancestral lands and universal liberty.',
      '25:18–34 (The Redemption of Property)': 'Divine ownership dictates that land cannot be sold permanently and must remain accessible for redemption by kinsmen.',
      '25:35–55 (The Redemption of the Poor and Enslaved)': 'Provisions against charging interest and mandates for releasing debt-slaves ensure that no Israelite remains in perpetual bondage.',
      '26 (Blessings and Curses)': 'Divine promises and warnings illustrate the consequences of the covenant relationship between God and Israel.',
      '27 (Laws Concerning Vows and Tithes)': 'The book concludes with regulations for dedicating people, animals, or property to the Lord and the mandatory tithing of the land\'s produce.',
      'Numbers': 'Chronicles Israel\'s journey from Mount Sinai to the plains of Moab, focusing on the census of the tribes and the forty-year wilderness wandering resulting from the nation\'s repeated rebellion.',
      '1–4 (The Census and Organization of the Camp)': 'God commands a census of the tribes and assigns specific duties to the Levites to ensure the orderly transport of the Tabernacle.',
      '5–10:10 (Purification and Preparation for the Journey)': 'The Israelites receive laws on ritual purity, the Nazirite vow, and the silver trumpets used to signal the camp\'s movement.',
      '5:1–4 (The Purity of the Camp)': 'The Lord commands that anyone with a defiling skin disease or bodily discharge be moved outside the camp to maintain the holiness of God\'s dwelling place.',
      '5:5–10 (Restitution for Wrongs)': 'Specific laws require a person who wrongs another to confess their sin and pay full restitution plus twenty percent to the victim or their kinsman.',
      '5:11–31 (The Test for an Unfaithful Wife)': 'A ritual involving "bitter water that brings a curse" is prescribed for a husband who suspects his wife of adultery without witnesses to prove it.',
      '6:1–21 (The Nazirite Vow)': 'Rules are established for individuals taking a special vow of separation, which includes abstaining from wine, not cutting their hair, and avoiding contact with the dead.',
      '6:22–27 (The Priestly Blessing)': 'The Lord gives Aaron and his sons the specific words to speak over the Israelites to place His name and blessing upon them.',
      '7 (Offerings from the Leaders)': 'Upon the completion of the Tabernacle, the leaders of the twelve tribes bring identical, elaborate gifts of silver, gold, and livestock over twelve consecutive days.',
      '8:1–4 (Setting Up the Lamps)': 'Aaron is instructed to set up the seven lamps on the golden lampstand so that they give light in front of it.',
      '8:5–26 (The Setting Apart of the Levites)': 'The Levites are purified and presented as a wave offering to the Lord, taking the place of the firstborn sons of Israel for sanctuary service.',
      '9:1–14 (The Second Passover)': 'God allows those who were ceremonially unclean or away on a journey during the regular Passover to observe it one month later.',
      '9:15–23 (The Cloud Above the Tabernacle)': 'The movement of the Israelites is dictated entirely by the cloud of fire and glory; when it lifted they moved, and when it settled they stayed.',
      '10:1–10 (The Silver Trumpets)': 'Two hammered silver trumpets are fashioned to be used for summoning the community, signaling the breaking of camp, and sounding alarms in war.',
      '10:11–14 (Departure from Sinai and the Rebellion at Kadesh)': 'The nation journeys toward Canaan but refuses to enter after a fearful report from the spies, resulting in a forty-year sentence of wandering.',
      '15–19 (Laws and Rebellions in the Wilderness)': 'This section covers additional sacrificial laws and the rebellion of Korah, which reaffirms the authority of Aaron\'s priesthood.',
      '20–25 (The Journey from Kadesh to Moab)': 'As the first generation dies out, Moses strikes the rock in anger, and the prophet Balaam is hired to curse Israel but blesses them instead.',
      '20:1–13 (Water from the Rock at Meribah)': 'After Miriam dies, the people complain of thirst, leading Moses to strike the rock in anger instead of speaking to it, which results in God barring him and Aaron from entering Canaan.',
      '20:14–29 (Edom\'s Refusal and the Death of Aaron)': 'Edom denies Israel passage through their land, forcing a detour to Mount Hor where Aaron dies and his son Eleazar is invested as high priest.',
      '21:1–9 (Victory at Hormah and the Bronze Snake)': 'Following a victory over the Canaanite king of Arad, the Israelites grumble and are punished by venomous snakes until Moses sets up a bronze serpent for their healing.',
      '21:21–35 (The Defeat of Sihon and Og)': 'Israel decisively defeats the Amorite king Sihon and the giant King Og of Bashan to take possession of their lands.',
      '22–24 (Balak and Balaam)': 'Terrified of Israel, King Balak of Moab hires the seer Balaam to curse them, but God intervenes through a speaking donkey and compels Balaam to utter four distinct blessings instead.',
      '25 (Apostasy at Shittim)': 'While camped at Shittim, Israelite men fall into sexual immorality and idolatry with Moabite women, a plague only halted by the zeal of Phinehas.',
      '26–30 (The Second Census and New Regulations)': 'A second census is taken of the new generation, and God provides instructions for female inheritance and the making of vows.',
      '31–36 (Preparation to Enter the Promised Land)': 'The book concludes with the defeat of the Midianites, the division of land east of the Jordan, and the designation of Cities of Refuge.',
      'Deuteronomy': 'A powerful call to covenant faithfulness, emphasizing the importance of love, obedience, and remembrance in maintaining a relationship with God.',
      '1–4:43 (Historical Prologue)': 'Moses reviews Israel\'s journey from Horeb to the plains of Moab, emphasizing how God\'s faithfulness persevered despite the previous generation\'s rebellion.',
      '4:44–26 (The Exposition of the Law)': 'Moses restates the Ten Commandments and provides an extensive collection of statutes and ordinances to govern Israel\'s civil and religious life in the Promised Land.',
      '4:44–49 (Introduction to the Second Address)': 'A narrative heading that sets the scene in the valley near Beth Peor, identifying the following text as the "law, testimonies, statutes, and ordinances" Moses gave after the Exodus.',
      '5 (The Ten Commandments)': 'Moses summons all Israel to hear the Decalogue, reminding them of the covenant made at Horeb and his role as mediator between God\'s fire and the people.',
      '5:1–5 (The Introduction to the Covenant)': 'Moses emphasizes that the covenant made at Horeb was not just for their ancestors, but for the living generation, as he stood between the Lord and the people to declare His word.',
      '5:6–21 (The Ten Commandments)': 'God speaks directly out of the fire to deliver the foundational laws, covering exclusive worship, the prohibition of idols, the holiness of His name, the Sabbath, and social ethics.',
      '5:22–27 (The People\'s Fear at Horeb)': 'Overwhelmed by the voice of God, the darkness, and the cloud, the tribal leaders approach Moses in terror, requesting that he serve as their mediator.',
      '5:28–33 (The Lord\'s Response and Moses\' Charge)': 'The Lord commends the people\'s reverent fear and instructs Moses to give them the full set of commands they must follow to live and prosper in the land.',
      '6–11 (The Primary Commandment: Loving God)': 'This section expounds on the "Shema", urging Israel to love the Lord with all their heart, teach His laws to their children, and remain separate from the idolatry of the nations they will dispossess.',
      '12–16:17 (Ceremonial and Ritual Laws)': 'Specific regulations for communal worship, including the centralization of sacrifice at a single chosen place, dietary restrictions, the tithing system, and the observance of the three major festivals.',
      '12 (The One Place of Worship)': 'Israel is commanded to destroy all Canaanite shrines and bring their sacrifices, tithes, and vows only to the specific location the Lord chooses to dwell.',
      '13 (Warning Against Idolatry)': 'Moses warns against enticements to worship other gods, whether from false prophets, close family members, or entire wicked cities, prescribing the death penalty to purge the evil.',
      '14:1–21 (Clean and Unclean Food)': 'The people are forbidden from pagan mourning customs and given specific dietary restrictions on which land animals, sea creatures, and birds are ceremonially clean to eat.',
      '14:22–15 (Tithes, Debts, and Firstborns)': 'This section outlines the annual tithe, the seven-year cancellation of debts, the generous treatment of the poor, and the dedication of firstborn male livestock to God.',
      '16:1–17 (The Three Main Festivals)': 'The law mandates the celebration of Passover, the Festival of Weeks, and the Festival of Tabernacles, requiring all men to appear before the Lord with a gift in hand.',
      '16:18–18 (Civil and Religious Authorities)': 'Laws governing the leadership of Israel, establishing the roles and limits of judges, kings, priests, and the "Prophet like Moses" who would come in the future.',
      '19–25 (Social and Criminal Statutes)': 'A diverse collection of laws regarding cities of refuge, warfare, property rights, marriage, and criminal justice, designed to maintain holiness and equity within the land.',
      '19:1–13 (Cities of Refuge)': 'God commands the setting aside of specific cities where a person who kills someone accidentally can flee for safety from the avenger of blood.',
      '19:14 (Property Landmarks)': 'A prohibition is established against moving a neighbor\'s boundary marker, which protected ancestral land rights.',
      '19:15–21 (Laws Concerning Witnesses)': 'The law requires at least two or three witnesses to convict a person, and false witnesses are to receive the same punishment they intended for the accused.',
      '20 (Laws of Warfare)': 'Instructions are given for battle, including priest-led encouragement, exemptions from service for specific personal reasons, and rules for besieging cities.',
      '21:1–9 (Atonement for Unsolved Murders)': 'A ritual involving the elders of the nearest town and a heifer is prescribed to cleanse the land when a murder victim is found and the killer is unknown.',
      '21:10–25:19 (Miscellaneous Civil and Domestic Laws)': 'A large collection of various statutes covering family life, property, hygiene, and social justice.',
      '21:10–14 (Marriage to a Captive Woman)': 'Regulations protecting the dignity and rights of a female prisoner of war whom an Israelite desires to marry.',
      '21:15–17 (Rights of the Firstborn)': 'A law prohibiting a father from transferring the birthright of his eldest son to a younger son based on his preference for one wife over another.',
      '21:18–21 (The Rebellious Son)': 'The procedure for parents to bring a chronically defiant, gluttonous, and drunken son before the elders for capital punishment.',
      '21:22–23 (Burial of a Hanged Man)': 'A requirement that the body of an executed criminal hung on a tree must be buried the same day to avoid desecrating the land.',
      '22:1–4 (Assisting a Neighbor\'s Livestock)': 'The duty to return a neighbor\'s stray animal or help them lift a beast that has fallen under its load.',
      '22:5 (Prohibition of Cross-Dressing)': 'A command for men and women to maintain distinct identities by not wearing the clothing associated with the opposite sex.',
      '22:6–7 (Protecting a Mother Bird)': 'A humanitarian law allowing the taking of eggs or young birds but requiring the mother bird to be set free.',
      '22:8 (Safety Parapets on Roofs)': 'A building code requiring a railing around the roof of a house to prevent people from falling off.',
      '22:9–12 (Laws of Prohibited Mixtures)': 'Statutes forbidding the sowing of two types of seed in a vineyard, plowing with an ox and donkey together, or wearing wool and linen mixed.',
      '22:13–30 (Sexual Purity and Marriage)': 'Detailed laws regarding the evidence of virginity, adultery, rape, and prohibited degrees of marriage.',
      '23:1–8 (Exclusion from the Assembly)': 'Specific physical and ancestral criteria that prevent certain individuals from entering the formal assembly of the Lord.',
      '23:9–14 (Camp Holiness and Hygiene)': 'Regulations for maintaining ritual and physical cleanliness within the military camp, including the proper disposal of waste.',
      '23:15–25 (Social and Economic Protections)': 'Laws protecting runaway slaves, prohibiting interest on loans to fellow Israelites, and regulating the fulfillment of vows.',
      '24:1–4 (Divorce and New Marriage)': 'The legal process for a certificate of divorce and the exemption of a newly married man from military service for one year.',
      '24:5–22 (Justice for the Vulnerable)': 'Protections for the poor and marginalized, including laws against kidnapping, regulations on collateral for loans, and the requirement to leave gleanings in the field.',
      '25:1–4 (Flogging Limits and Care for Animals)': 'A cap of forty lashes for the guilty and a prohibition against muzzling an ox while it treads out the grain.',
      '25:5–10 (Levirate Marriage)': 'The "Kinsman-Redeemer" obligation for a man to provide an heir for his deceased brother through his widow.',
      '25:13–16 (Honest Weights and Measures)': 'A mandate for strict integrity in commerce, requiring accurate stones and measures in the marketplace.',
      '25:17–19 (The Command to Blot Out Amalek)': 'A final charge to remember the unprovoked attack by the Amalekites and to eventually eliminate their memory under heaven.',
      '26 (The Liturgical Conclusion)': 'Instructions for offering firstfruits and the triennial tithe, concluding with a formal declaration of the mutual commitment between the Lord and His "treasured people."',
      '27–28 (Blessings and Curses)': 'The nation is instructed to formalize their commitment to the Law through a ceremony of blessings for obedience and severe warnings of curses for disobedience.',
      '27:1–8 (The Altar on Mount Ebal)': 'Upon crossing the Jordan, the Israelites are commanded to set up large stones coated with plaster, write the Law on them, and build an altar of uncut stones to offer sacrifices.',
      '27:11–26 (Curses from Mount Ebal)': 'Half the tribes stand on Mount Gerizim to bless and half on Mount Ebal to curse, as the Levites recite twelve specific curses against secret sins like idolatry, disrespecting parents, and injustice.',
      '28:1–14 (Blessings for Obedience)': 'Moses enumerates the abundant blessings that will come upon the nation if they fully obey the Lord, including prosperity in city and field, victory over enemies, and fruitful wombs.',
      '28:15–44 (Curses for Disobedience)': 'This section details the horrific consequences of turning away from God\'s commands, ranging from disease and drought to military defeat and economic ruin.',
      '28:45–68 (The Ultimate Curse: Exile)': 'The final warning describes a persistent siege leading to desperation and the eventual scattering of the people among all nations where they will find no rest.',
      '29–30 (The Covenant in Moab)': 'Moses urges the new generation to choose life by loving and obeying God, promising restoration even after future periods of exile.',
      '31–34 (The Final Days of Moses)': 'After commissioning Joshua as his successor and reciting a prophetic song, Moses views the Promised Land from Mount Nebo and dies.',
      '31:1–8 (Joshua Commissioned as Successor)': 'Moses, being 120 years old and unable to enter the Promised Land, encourages Israel and publicly commissions Joshua to lead them with courage.',
      '31:9–29 (The Law and the Future Rebellion)': 'Moses commands the periodic public reading of the Law and predicts that Israel will turn away from God after his death, necessitating a song as a witness against them.',
      '32:1–43 (The Song of Moses)': 'In a poetic witness, Moses extols God as the faithful Rock while rebuking Israel\'s future apostasy and describing the divine judgment and eventual vindication that will follow.',
      '32:44–52 (Moses\' Final Command and Fate)': 'After finishing his song, Moses is commanded by God to climb Mount Nebo to view the land he cannot enter due to his previous unfaithfulness at Meribah.',
      '33 (The Blessing of Moses)': 'Before his death, Moses pronounces specific prophetic blessings upon each of the tribes of Israel, concluding with a hymn of praise to God as Israel\'s shield and helper.',
      '34 (The Death and Legacy of Moses)': 'Moses dies on Mount Nebo and is buried by God in an unknown location, leaving a legacy as a unique prophet who knew the Lord face to face.',

      // Genesis verses
      'Gen 1:1': 'In the beginning God created the heaven and the earth.',
      'Gen 1:2': 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.',
      'Gen 1:3': 'And God said, Let there be light: and there was light.',
      'Gen 1:4': 'And God saw the light, that it was good: and God divided the light from the darkness.',
      'Gen 1:5': 'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.',
      'Gen 1:6': 'And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.',
      'Gen 1:7': 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament: and it was so.',
      'Gen 1:8': 'And God called the firmament Heaven. And the evening and the morning were the second day.',
      'Gen 1:9': 'And God said, Let the waters under the heaven be gathered together unto one place, and let the dry land appear: and it was so.',
      'Gen 1:10': 'And God called the dry land Earth; and the gathering together of the waters called he Seas: and God saw that it was good.',
      'Gen 1:11': 'And God said, Let the earth bring forth grass, the herb yielding seed, and the fruit tree yielding fruit after his kind, whose seed is in itself, upon the earth: and it was so.',
      'Gen 1:12': 'And the earth brought forth grass, and herb yielding seed after his kind, and the tree yielding fruit, whose seed was in itself, after his kind: and God saw that it was good.',
      'Gen 1:13': 'And the evening and the morning were the third day.',
      'Gen 1:31': 'God saw all that he had made, and it was very good. And there was evening, and there was morning — the sixth day.',
      'Gen 2:1': 'Thus the heavens and the earth were finished, and all the host of them.',
      'Gen 2:2': 'And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made.',
      'Gen 2:3': 'And God blessed the seventh day, and sanctified it: because that in it he had rested from all his work which God created and made.',
      'Gen 2:22': 'Then the Lord God made a woman from the rib he had taken out of the man, and he brought her to the man.',
      'Gen 3:16': 'To the woman he said, "I will make your pains in childbearing very severe; with painful labor you will give birth to children. Your desire will be for your husband, and he will rule over you."',
      'Gen 4:16': 'So Cain went out from the Lord\'s presence and lived in the land of Nod, east of Eden.',
      'Gen 15:6': 'Abram believed the Lord, and he credited it to him as righteousness.',

      // Exodus verses
      'Exod 8:22': 'But on that day I will deal differently with the land of Goshen, where my people live; no swarms of flies will be there, so that you may know that I, the Lord, am in this land.',
      'Exod 8:23': 'I will make a distinction between my people and your people. This sign will occur tomorrow.',
      'Exod 9:4': 'But the Lord will make a distinction between the livestock of Israel and that of Egypt, so that no animal belonging to the Israelites will die.',
      'Exod 9:5': 'The Lord set a time and said, "Tomorrow the Lord will do this in the land."',
      'Exod 9:6': 'And the next day the Lord did it: All the livestock of the Egyptians died, but not one animal belonging to the Israelites died.',
      'Exod 9:26': 'The only place it did not hail was the land of Goshen, where the Israelites were.',
      'Exod 12:13': 'The blood will be a sign for you on the houses where you are, and when I see the blood, I will pass over you. No destructive plague will touch you when I strike Egypt.',
      'Exod 20:3': 'You shall have no other gods before me.',
      'Exod 20:4': 'You shall not make for yourself an image in the form of anything in heaven above or on the earth beneath or in the waters below.',
      'Exod 20:5': 'You shall not bow down to them or worship them; for I, the Lord your God, am a jealous God, punishing the children for the sin of the parents to the third and fourth generation of those who hate me.',
      'Exod 20:11': 'For in six days the Lord made the heavens and the earth, the sea, and all that is in them, but he rested on the seventh day. Therefore the Lord blessed the Sabbath day and made it holy.',
      'Exod 21:20': 'Anyone who beats their male or female slave with a rod must be punished if the slave dies as a direct result.',
      'Exod 21:21': 'But they are not to be punished if the slave recovers after a day or two, since the slave is their property.',
      'Exod 22:29': 'Do not hold back offerings from your granaries or your vats. You must give me the firstborn of your sons.',
      'Exod 26:31': 'Make a curtain of blue, purple and scarlet yarn and finely twisted linen, with cherubim woven into it by a skilled worker.',
      'Exod 39:2': 'They made the ephod of gold, and of blue, purple and scarlet yarn, and of finely twisted linen.',

      // Leviticus verses
      'Lev 21:9': 'If a priest\'s daughter defiles herself by becoming a prostitute, she disgraces her father; she must be burned in the fire.',
      'Lev 24:16': 'Anyone who blasphemes the name of the Lord is to be put to death; the entire assembly must stone them.',
      'Lev 25:44': 'Your male and female slaves are to come from the nations around you; from them you may buy slaves.',
      'Lev 25:45': 'You may also buy some of the temporary residents living among you and members of their clans born in your country, and they will become your property.',
      'Lev 25:46': 'You can bequeath them to your children as inherited property and can make them slaves for life, but you must not rule over your fellow Israelites ruthlessly.',
      'Lev 26:13': 'I am the Lord your God, who brought you out of Egypt so that you would no longer be slaves to the Egyptians; I broke the bars of your yoke and enabled you to walk with heads held high.',
      'Lev 26:21': 'If you remain hostile toward me and refuse to listen to me, I will multiply your afflictions seven times over, as your sins deserve.',
      'Lev 26:22': 'I will send wild animals against you, and they will rob you of your children, destroy your cattle and make you so few in number that your roads will be deserted.',

      // Numbers verses
      'Num 6:24': 'The Lord bless you and keep you.',
      'Num 6:25': 'The Lord make his face shine on you and be gracious to you.',
      'Num 6:26': 'The Lord turn his face toward you and give you peace.',
      'Num 20:12': 'But the Lord said to Moses and Aaron, "Because you did not trust in me enough to honor me as holy in the sight of the Israelites, you will not bring this community into the land I give them."',
      'Num 25:6': 'Then an Israelite man brought into the presence of his relatives a Midianite woman right before the eyes of Moses and the whole assembly of Israel while they were weeping at the entrance to the tent of meeting.',
      'Num 25:7': 'When Phinehas son of Eleazar, the son of Aaron, the priest, saw this, he left the assembly, took a spear in his hand.',
      'Num 25:8': 'And followed the Israelite into the tent. He drove the spear through both of them, right through the Israelite man and into the woman\'s body. Then the plague against the Israelites was stopped.',
      'Num 25:9': 'But those who died in the plague numbered 24,000.',

      // Deuteronomy verses
      'Deut 5:7': 'You shall have no other gods before me.',
      'Deut 5:8': 'You shall not make for yourself an image in the form of anything in heaven above or on the earth beneath or in the waters below.',
      'Deut 5:9': 'You shall not bow down to them or worship them; for I, the Lord your God, am a jealous God, punishing the children for the sin of the parents to the third and fourth generation of those who hate me.',
      'Deut 13:6': 'If your very own brother, or your son or daughter, or the wife you love, or your closest friend secretly entices you, saying, "Let us go and worship other gods" — gods that neither you nor your ancestors have known.',
      'Deut 13:7': 'Do not yield to them or listen to them. Show them no pity. Do not spare them or shield them.',
      'Deut 13:8': 'You must certainly put them to death. Your hand must be the first in putting them to death, and then the hands of all the people.',
      'Deut 13:9': 'Stone them to death, because they tried to turn you away from the Lord your God, who brought you out of Egypt, out of the land of slavery.',
      'Deut 21:23': 'You must not leave the body hanging on the pole overnight. Be sure to bury it that same day, because anyone who is hung on a pole is under God\'s curse. You must not desecrate the land the Lord your God is giving you as an inheritance.',
      'Deut 28:53': 'Because of the suffering your enemy will inflict on you during the siege, you will eat the fruit of the womb, the flesh of the sons and daughters the Lord your God has given you.',
      'Deut 32:41': 'When I sharpen my flashing sword and my hand grasps it in judgment, I will take vengeance on my adversaries and repay those who hate me.',
      'Deut 32:42': 'I will make my arrows drunk with blood, while my sword devours flesh: the blood of the slain and the captives, the heads of the enemy leaders.',

      'Prophetic Books': 'Records the messages God delivered through His spokesmen, urging repentance from idolatry and injustice, warning of judgment and exile, and offering hope through promises of restoration and the Messiah.',
      'The Major Prophets': 'Five extensive prophetic books providing oracles regarding the judgment of Israel and the nations, the Babylonian exile, and the hope of a future messianic kingdom.',
      'Isaiah': 'Prophecies of judgment and salvation, the coming Messiah, and God\'s sovereign plan for Israel and the nations.',
      '1–35 (Judgment and Promise)': 'Oracles condemning the sins of Judah and the nations, interspersed with prophecies of the Branch and the coming King.',
      '1 (The Great Arraignment)': 'God accuses Judah of rebellion and hypocrisy, offering the choice between being washed white as snow or being devoured by the sword.',
      'Isaiah 1:18': '"Come now, let us settle the matter," says the Lord. "Though your sins are like scarlet, they shall be as white as snow; though they are red as crimson, they shall be like wool."',
      '2–4 (The Mountain of the Lord and the Day of Judgment)': 'Isaiah envisions a future of global peace centered on Zion, contrasted with the pride of Israel and the subsequent judgment of Jerusalem.',
      '2:1–4 (The Mountain of the Lord)': 'Isaiah envisions a future where all nations stream to the temple to learn God\'s ways, resulting in a world where weapons are beaten into plowshares.',
      'Isaiah 2:4': 'He will judge between the nations and will settle disputes for many peoples. They will beat their swords into plowshares and their spears into pruning hooks. Nation will not take up sword against nation, nor will they train for war anymore.',
      '2:6–22 (The Day of the Lord)': 'God will humble human pride and destroy idols during a day of judgment that will shake the earth and force people to hide from the glory of His majesty.',
      '3:1–15 (The Collapse of Society)': 'God removes the leaders and food supply of Jerusalem, leading to anarchy where children rule over elders and the wealthy are condemned for oppressing the poor.',
      '3:16–4:1 (The Judgment on the Daughters of Zion)': 'The arrogant women of Jerusalem who flaunt their luxury are threatened with humiliation and loss of ornaments as the city\'s men fall in battle.',
      '4:2–6 (The Branch of the Lord)': 'A remnant will be called holy, and the Lord will create a cloud by day and fire by night over Mount Zion as a canopy of protection.',
      '5 (The Song of the Vineyard and Six Woes)': 'Using a parable of a neglected vineyard, God laments the lack of justice in Israel, pronouncing woes upon those who covet land and call evil good.',
      '6 (Isaiah\'s Call and Commission)': 'In the year King Uzziah died, Isaiah sees a vision of God\'s holiness in the Temple, leading to his purification and a difficult mission to a people who will not listen.',
      '7:1–9:7 (The Book of Immanuel)': 'During the Syro-Ephraimite crisis, Isaiah offers King Ahaz the sign of Immanuel and prophesies a coming Prince of Peace who will reign on David\'s throne.',
      '9:8–10:34 (Judgment on Israel and Assyria)': 'God rebukes the northern kingdom for its arrogance and turns His judgment toward Assyria, the rod of His anger, for its own boastful pride.',
      '11–12 (The Righteous Branch and the Song of Trust)': 'A new ruler emerges from the stump of Jesse to restore harmony to creation, prompting a song of praise for God\'s salvation.',
      '13:1–23:18 (Oracles Against the Nations)': 'Divine judgments against Babylon, Philistia, Moab, Damascus, Egypt, Tyre, and others, demonstrating God\'s sovereignty over the entire world.',
      '13:1–14:23 (The Oracle Against Babylon)': 'Isaiah prophesies the total destruction of Babylon by the Medes and includes a taunt-song over the fallen king who attempted to exalt himself above the stars.',
      '13:1–8 (The Call to Arms)': 'The Lord summons a sanctified army from the ends of the heavens to serve as the weapons of His indignation against Babylon.',
      'Isaiah 13:1': 'The burden concerning Babylon which Isaiah the son of Amoz saw.',
      '13:9–16 (The Day of the Lord)': 'A cosmic upheaval where the sun and moon are darkened and the earth is shaken, making humans scarcer than gold of Ophir.',
      'Isaiah 13:10': 'For the stars of heaven and their constellations will not give their light; the sun will be dark when it rises, and the moon will not shed its light.',
      '13:17–22 (The Medes and the Desolation of Babylon)': 'The Medes are identified as the agents of destruction who will turn the glory of kingdoms into a perpetual wasteland.',
      '14:1–2 (The Restoration of Israel)': 'A brief interlude promises that the Lord will have compassion on Jacob, resettling Israel in their own land.',
      '14:3–11 (The Taunt Against the King of Babylon)': 'The survivors of the nations mock the Babylonian tyrant as he descends into Sheol to be greeted by the shades of former kings.',
      '14:12–15 (The Fall of the Day Star)': 'The king\'s hubris is exposed through five "I will" statements of self-exaltation, contrasting his desire for the mount of assembly with his descent into the pit.',
      '14:16–21 (The Unburied Corpse)': 'Unlike other kings who lie in glory, the Babylonian ruler is cast out like a loathed branch, denied burial because he destroyed his own land.',
      '14:22–23 (The Final Erasure)': 'A divine vow to cut off Babylon\'s name, survivors, and offspring, sweeping the city away with the broom of destruction.',
      '14:24–27 (The Oracle Against Assyria)': 'A divine oath confirms that God will break the Assyrian yoke within His own land, demonstrating His purpose over all nations.',
      '14:28–32 (The Oracle Against Philistia)': 'The Philistines are warned not to rejoice, as a more devastating judgment is coming from the north.',
      '15:1–16:14 (The Oracle Against Moab)': 'The prophet describes a landscape of mourning as Moab\'s cities are laid waste, expressing a sense of divine grief over the refugees.',
      '17 (The Oracle Against Damascus and Israel)': 'The alliance between Syria and the northern kingdom is condemned to ruin, leaving only a small remnant like the few olives after a harvest.',
      '18 (The Oracle Against Cush/Ethiopia)': 'Messengers from the upper Nile are told to wait for the Lord\'s signal, which will lead to the people of Cush bringing tribute to Mount Zion.',
      '19 (The Oracle Against Egypt)': 'Egypt faces civil war and economic collapse, but the passage ends with a startling vision of Egypt, Assyria, and Israel all worshiping God together.',
      '19:1–10 (A Prophecy Against Egypt)': 'The Lord rides on a swift cloud to bring judgment, causing the idols of Egypt to tremble and the Nile to dry up, crippling the nation\'s economy.',
      '19:16–17 (The Terror of Judah)': 'In that day, the Egyptians will tremble at the uplifted hand of the Lord and at the very mention of the land of Judah.',
      '19:18–22 (Egypt\'s Conversion to the Lord)': 'Five cities in Egypt will speak the language of Canaan and swear allegiance to the Lord, who will strike and then heal them when they cry out.',
      '19:23–25 (A Highway of Blessing)': 'A highway will connect Egypt, Assyria, and Israel as the Lord blesses them together, calling Egypt "my people" and Assyria "my handiwork."',
      'Isaiah 19:24': 'In that day Israel will be the third, together with Egypt and Assyria, a blessing on the earth.',
      'Isaiah 19:25': 'The Lord Almighty will bless them, saying, "Blessed be Egypt my people, Assyria my handiwork, and Israel my inheritance."',
      '20 (The Sign Against Egypt and Cush)': 'For three years, Isaiah walks stripped and barefoot as a physical sign of the coming shame that Assyria will bring upon the Egyptians and Ethiopians.',
      '21 (The Oracles Against the Desert, Dumah, and Arabia)': 'A series of grim visions depicts the fall of Babylon, the persistent questioning of a watchman in Edom, and the flight of Arabian caravans from war.',
      '22 (The Oracle Against the Valley of Vision)': 'Jerusalem is rebuked for its misplaced revelry during a siege and its reliance on physical defenses rather than on the Maker of the city.',
      '23 (The Oracle Against Tyre and Sidon)': 'The great maritime power of Phoenicia is humbled and forgotten for seventy years, after which its profits will be set apart as holy to the Lord.',
      '24:1–27:13 (The Little Apocalypse)': 'The focus shifts to a global perspective, describing the desolation of the earth and the final victory of God, who will swallow up death forever.',
      '28:1–33:24 (The Six Woes Concerning Israel and Judah)': 'Warnings issued against those relying on foreign alliances and covenants with death rather than trusting in the cornerstone laid in Zion.',
      '34:1–35:10 (The Desert Blooms and the Ransomed Return)': 'The section concludes by contrasting the total desolation of Edom with the miraculous transformation of the wilderness into a blooming highway for the redeemed.',
      '36–39 (Historical Interlude)': 'A narrative bridge detailing Hezekiah\'s reign, the deliverance from Assyria, and the prediction of the future Babylonian exile.',
      '36 (Sennacherib Invades Judah)': 'The Assyrian king captures Judah\'s cities and sends the Rabshakeh to mock Hezekiah\'s trust in Egypt and the Lord.',
      '37:1–20 (Hezekiah\'s Prayer)': 'Deeply distressed, Hezekiah humbles himself in the Temple and sends for Isaiah, who assures him that God will defend the city for His own sake.',
      '37:21–38 (The Fall of the Assyrians)': 'God answers Hezekiah\'s prayer by striking down 185,000 Assyrian soldiers, forcing Sennacherib to retreat to Nineveh where he is assassinated.',
      'Isaiah 37:36': 'Then the angel of the Lord went out and put to death a hundred and eighty-five thousand in the Assyrian camp. When the people got up the next morning—there were all the dead bodies!',
      '38:1–8 (Hezekiah\'s Sickness and Healing)': 'Facing a terminal illness, Hezekiah weeps and prays, and God grants him fifteen more years of life with a miraculous sign on the sundial of Ahaz.',
      '38:9–22 (Hezekiah\'s Song of Thanksgiving)': 'After his recovery, the king composes a poetic reflection on his passage from the gates of death to the joy of restoration.',
      '39 (Envoys from Babylon)': 'In a moment of pride, Hezekiah shows Jerusalem\'s treasures to Babylonian messengers, leading Isaiah to prophesy the future exile of the royal house.',
      '40–48 (Deliverance for Exiles)': 'Messages of comfort announcing the end of captivity and the superiority of God over the idols of Babylon.',
      '40:1–11 (The Proclamation of Comfort)': 'God commands the prophets to comfort His people, announcing that their hard service is over and preparing a way for His glory to be revealed to all mankind.',
      '40:12–31 (The Incomparable Creator)': 'Isaiah contrasts the insignificance of nations and idols with the majestic power of God, who sits enthroned above the earth and gives strength to the weary.',
      '41 (The Helper of Israel)': 'The Lord summons the nations to court, challenging them to prove their idols\' power while reassuring Israel He will transform their dry land into a garden.',
      '42:1–9 (The First Servant Song)': 'God introduces His chosen Servant, who will bring justice to the nations with gentleness and serve as a light to the Gentiles.',
      '42:10–25 (A New Song of Praise and a Rebuked People)': 'A global call to praise God\'s coming intervention is followed by a lament over Israel\'s blindness and failure to learn from divine discipline.',
      '43:1–44:5 (Israel\'s Only Savior)': 'God promises to be with His people through fire and water, declaring that He alone is God and Savior who will pour out His Spirit on their descendants.',
      '43:1–7 (Israel\'s Only Savior)': 'God reassures Israel that they are His, promising to be with them through fire and water because He has redeemed and called them by name.',
      'Isaiah 43:1': 'But now, this is what the Lord says—he who created you, Jacob, he who formed you, Israel: "Do not fear, for I have redeemed you; I have summoned you by name; you are mine."',
      '43:8–13 (Witnesses to God\'s Sovereignty)': 'The Lord challenges the nations to produce their witnesses, declaring that Israel is His witness that He alone is God with no savior besides Him.',
      '43:14–21 (God\'s Mercy and Forgiveness)': 'God promises to do a new thing by providing a way in the wilderness and streams in the wasteland for His chosen people.',
      '43:22–28 (Israel\'s Sin and God\'s Forgiveness)': 'The Lord rebukes Israel for their lack of devotion yet declares He will blot out their transgressions for His own sake.',
      '44:1–5 (The Blessing on Israel)': 'God promises to pour out His Spirit and blessings on the offspring of Jeshurun, leading them to identify themselves as belonging to the Lord.',
      '44:6–28 (The Folly of Idolatry)': 'Isaiah mocks those who use half a piece of wood for fuel and the other half to carve a god, contrasting them with the Lord who redeems Israel.',
      '44:24–45:25 (The Commission of Cyrus)': 'God names the Persian King Cyrus as His anointed to rebuild Jerusalem, asserting His absolute sovereignty as the creator of light and darkness.',
      'Isaiah 45:5': 'I am the Lord, and there is no other; apart from me there is no God.',
      '46 (Bel Bows Down)': 'The idols of Babylon, Bel and Nebo, are depicted as heavy burdens that must be carried, while God reminds Israel that He has carried them since birth.',
      '47 (The Fall of Babylon)': 'Babylon is personified as a humiliated virgin daughter stripped of her throne because of her pride, sorcery, and oppression of God\'s people.',
      '48 (Refined for God\'s Glory)': 'The Lord rebukes Israel for their stubbornness but announces He will delay His wrath for His own name\'s sake, urging them to flee Babylon.',
      '49–57 (The Servant\'s Ministry)': 'Prophecies focusing on the Suffering Servant who atones for sin, culminating in the invitation to the thirsty to come and drink.',
      '49:1–13 (The Second Servant Song)': 'The Servant describes his mission to restore Israel and become a light to the Gentiles, bringing God\'s salvation to the ends of the earth.',
      '49:14–50:3 (Zion\'s Children Restored)': 'God reassures a doubting Zion that He has not forgotten her, promising that her children will return and her oppressors be defeated.',
      '50:4–11 (The Third Servant Song)': 'The Servant expresses his unwavering obedience and face-set-like-flint determination despite physical abuse and mockery.',
      '51:1–52:12 (A Call to Trust and Awake)': 'God commands His people to look to their ancestors and wake up to the reality of their impending redemption and departure from exile.',
      '52:13–53:12 (The Fourth Servant Song)': 'The Suffering Servant passage details the Servant\'s substitutionary death for the sins of others and his ultimate exaltation.',
      '52:13–15 (The Servant\'s Surprising Success)': 'God announces that His servant will be highly exalted despite a disfigured appearance that initially shocks the nations.',
      '53:1–3 (The Servant\'s Lowly Origins and Rejection)': 'The speakers marvel at the servant\'s unremarkable upbringing and the fact that he was despised and avoided by humanity.',
      'Isaiah 53:3': 'He was despised and rejected by men, a man of sorrows and acquainted with grief; and as one from whom men hide their faces he was despised, and we esteemed him not.',
      '53:4–6 (The Servant\'s Substitutionary Suffering)': 'The servant bore the punishment and sicknesses belonging to the people to bring them peace and healing.',
      'Isaiah 53:4': 'Surely he has borne our griefs and carried our sorrows; yet we esteemed him stricken, smitten by God, and afflicted.',
      'Isaiah 53:5': 'But he was wounded for our transgressions, he was bruised for our iniquities; the chastisement of our peace was upon him; and with his stripes we are healed.',
      'Isaiah 53:6': 'All we like sheep have gone astray; we have turned every one to his own way; and the Lord has laid on him the iniquity of us all.',
      '53:7–9 (The Servant\'s Silent Submission and Death)': 'Like a lamb led to the slaughter, the servant suffers an unjust trial and death without protest and is buried among the wicked.',
      '53:10–12 (The Servant\'s Final Vindication and Reward)': 'God\'s plan to prosper the servant for his sacrifice, granting him a portion among the great for interceding for sinners.',
      '54 (The Eternal Covenant of Peace)': 'God uses the imagery of a barren woman to promise Zion an explosion of descendants and a future secure from all weapons and strife.',
      '55 (An Invitation to the Thirsty)': 'The Lord offers a free, everlasting covenant to all who hunger for the truth, promising that His word will always achieve its divine purpose.',
      '55:1–5 (An Invitation to the Thirsty)': 'God offers a free, eternal banquet and promises to renew the everlasting covenant made with David, positioning Israel as a witness to the nations.',
      '55:6–9 (The Call to Repentance)': 'The prophet urges the wicked to forsake their ways and turn to the Lord, whose thoughts and ways are infinitely higher than human understanding.',
      'Isaiah 55:8': '"For my thoughts are not your thoughts, neither are your ways my ways," declares the Lord.',
      'Isaiah 55:9': '"As the heavens are higher than the earth, so are my ways higher than your ways and my thoughts than your thoughts."',
      '55:10–11 (The Power of God\'s Word)': 'Just as rain and snow do not return to heaven without watering the earth, God\'s word is guaranteed to accomplish its divine purpose.',
      '55:12–13 (The Joyful Return of Nature)': 'A vision of the mountains and trees breaking into song as the people go out in joy, with the transformed landscape serving as an everlasting sign.',
      '56:1–8 (Salvation for the Outsider)': 'God declares that foreigners and eunuchs who keep His covenant will have a place of honor in His house of prayer for all nations.',
      '56:9–57:13 (Rebuking the Wicked Leaders)': 'The prophet condemns the blind watchmen of Israel and those who practice idolatry, contrasting their fate with the peace of the righteous.',
      '56:9–12 (The Blind Watchmen)': 'The Lord summons wild beasts to devour His people because Israel\'s leaders are described as blind, greedy dogs and shepherds who have no understanding.',
      'Isaiah 56:10': 'Israel\'s watchmen are blind, they all lack knowledge; they are all mute dogs, they cannot bark; they lie around and dream, they love to sleep.',
      '57:1–2 (The Death of the Righteous)': 'Isaiah laments that the righteous perish and no one takes it to heart, explaining they are being spared from the coming evil and enter into peace.',
      '57:3–10 (The Idolatry of the Rebels)': 'God summons the offspring of adulterers to judgment, vividly describing their pagan rituals and exhaustive, yet futile, pursuit of foreign gods.',
      '57:11–13 (The Failure of False Gods)': 'The Lord rebukes the people for their lack of fear toward Him and declares that when they cry out, their idols will be blown away by a mere breath.',
      '57:14–21 (Comfort for the Humble)': 'God promises to revive the spirit of the lowly and contrite while warning that there is no lasting peace for the wicked.',
      '58–66 (Final Glory)': 'A vision of the future restoration of Zion, the inclusion of the Gentiles, and the creation of new heavens and a new earth.',
      // Jeremiah
      'Jeremiah': 'Warnings of Judah\'s impending destruction, calls for repentance, and promises of a new covenant.',
      '1 (The Prophet\'s Call)': 'God commissions Jeremiah before his birth as a prophet to the nations and provides visions of an almond branch and a boiling pot signifying judgment from the north.',
      '1:1–3 (Superscription)': 'The book is introduced as the words of Jeremiah, son of Hilkiah, whose ministry spanned from the reign of Josiah until the final exile of Jerusalem.',
      '1:4–10 (The Call of Jeremiah)': 'God declares that He consecrated Jeremiah before birth to be a prophet to the nations and touches his mouth to empower him to pluck up and to plant.',
      'Jeremiah 1:5': 'Before I formed you in the womb I knew you, and before you were born I consecrated you; I appointed you a prophet to the nations.',
      '1:11–12 (The Vision of the Almond Branch)': 'The Lord shows Jeremiah a branch of a blossoming tree to symbolize that He is watching over His word to perform it quickly.',
      '1:13–16 (The Vision of the Boiling Pot)': 'A vision of a pot tilting from the north signifies the pouring out of judgment upon Judah because of their idolatry.',
      '1:17–19 (The Promise of Protection)': 'God commands Jeremiah to prepare for battle and promises to make him a fortified city and an iron pillar that his enemies cannot overcome.',
      '2–6 (Early Oracles Against Judah and Jerusalem)': 'A series of sermons condemning the people for forsaking the fountain of living waters and warning of an approaching military disaster.',
      '7–10 (The Temple Sermon and Idolatry)': 'The prophet rebukes those who trust in the temple\'s presence while practicing injustice and warns their idols will be powerless against divine wrath.',
      '11–20 (Jeremiah\'s Struggles and Confessions)': 'The prophet\'s complaints to God regarding his persecution, including symbolic acts like the ruined linen belt and the broken earthen jar.',
      '11 (The Broken Covenant)': 'Jeremiah reminds the people of the Sinai covenant and reveals a plot by the men of his hometown, Anathoth, to take his life.',
      '12 (Jeremiah\'s Complaint and God\'s Answer)': 'The prophet questions why the way of the wicked prospers, receiving a divine response that warns of even greater trials to come.',
      '13 (The Linen Belt and the Wine Jars)': 'Through the symbolic act of burying a waistcloth, God illustrates how He will mar the pride of Judah and Jerusalem.',
      '14–15 (The Drought and Rejection)': 'Jeremiah intercedes for the nation during a severe famine, but God declares that even Moses and Samuel could not change His mind about the coming judgment.',
      '16 (The Prophet\'s Lifestyle as a Sign)': 'God forbids Jeremiah from marrying or attending funerals to symbolize the impending end of joy and domestic life in the land.',
      '17 (The Heart\'s Deceit and the Sabbath)': 'The prophet contrasts those who trust in man with those who trust in God, delivering a warning regarding the hallowing of the Sabbath day.',
      '1–4 (Judah\'s Indelible Sin)': 'Describes sin as being engraved with a diamond point on the hearts of the people, leading to the loss of their inheritance.',
      'Jeremiah 17:4': 'Due to your fault in kindling God\'s anger, you will lose your inheritance and be forced to serve your enemies in an unknown land, as God\'s fire will burn forever.',
      '5–8 (The Two Ways)': 'Contrasts the cursed man who trusts in human strength like a desert shrub with the blessed man who trusts in the Lord like a tree by water.',
      '9–11 (The Deceitful Heart)': 'Contains the famous proverb about the heart\'s unknowable nature and a warning against those who amass wealth unjustly.',
      'Jeremiah 17:9': 'The heart is deceitful above all things and beyond cure. Who can understand it?',
      '12–18 (Jeremiah\'s Prayer for Healing)': 'A personal confession where the prophet appeals to God as his refuge and asks for vindication against his persecutors.',
      'Jeremiah 17:13': 'O Lord, the hope of Israel, all who forsake You will be put to shame. Those who turn away will be written down, because they have forsaken the fountain of living water, even the Lord.',
      '19–27 (Hallowing the Sabbath)': 'God commands the people to stop carrying burdens through the city gates on the Sabbath as a test of obedience.',
      '18 (The Potter\'s House)': 'Jeremiah observes a potter reworking a spoiled vessel, illustrating God\'s sovereign right to reshape nations according to their response to His warnings.',
      '19 (The Broken Earthenware Jar)': 'Jeremiah smashes a clay jar in the Valley of Ben-hinnom to symbolize the irreversible destruction of Jerusalem.',
      '20 (Conflict with Pashhur and a Final Lament)': 'After being beaten and put in stocks by a temple official, Jeremiah expresses his inner struggle, describing God\'s word as a fire shut up in his bones.',
      'Jeremiah 20:7': 'You deceived me, Lord, and I was deceived; you overpowered me and prevailed. I am ridiculed all day long; everyone mocks me.',
      '21–25 (Judgment on Kings and Prophets)': 'Scathing critiques of Judah\'s corrupt leadership and announcement of the specific seventy-year duration of the Babylonian captivity.',
      '26–29 (Conflict with False Prophets)': 'After narrowly escaping death, Jeremiah sends a letter to the exiles in Babylon and opposes Hananiah\'s false promises of a quick return.',
      '26 (The Temple Sermon and Jeremiah\'s Arrest)': 'Jeremiah warns that the temple will become like Shiloh and is seized by priests and prophets but spared through the intervention of officials.',
      '27 (The Symbolic Yoke)': 'Jeremiah wears a wooden yoke to command the surrounding nations to submit to the king of Babylon as God\'s appointed servant.',
      '28 (The Confrontation with Hananiah)': 'The false prophet Hananiah breaks Jeremiah\'s yoke and predicts a quick return, leading Jeremiah to prophesy Hananiah\'s death for preaching rebellion.',
      '29 (A Letter to the Exiles)': 'Jeremiah sends a message to the captives in Babylon urging them to build houses and plant gardens, promising God has plans for their hope and a future.',
      '29:1–9 (Instructions to the Exiles)': 'Jeremiah commands the exiles to settle down in Babylon, build houses, and seek the welfare of the city where they are held captive.',
      'Jeremiah 29:7': 'Also, seek the peace and prosperity of the city to which I have carried you into exile. Pray to the Lord for it, because if it prospers, you too will prosper.',
      '29:10–14 (The Promise of Restoration)': 'The Lord declares that after seventy years He will fulfill His gracious promise to bring the exiles home, stating that He knows the plans He has for them.',
      '29:15–20 (Judgment on Those Remaining)': 'God warns that the people left in Jerusalem will face sword, famine, and pestilence because they refused to listen to the words of the prophets.',
      '29:21–23 (The Fate of Ahab and Zedekiah)': 'Two false prophets in Babylon are condemned to a gruesome death for their adultery and for speaking lies in the name of the Lord.',
      '29:24–32 (The Message to Shemaiah)': 'After Shemaiah demands Jeremiah\'s arrest, the Lord announces that Shemaiah will have no descendants to see the good things coming to the covenant people.',
      '30–33 (The Book of Consolation)': 'God promises the future restoration of Israel and Judah, highlighted by the announcement of a New Covenant written on the hearts of the people.',
      '30 (The Restoration of Israel and Judah)': 'God promises to break the yoke of foreign oppression and heal the incurable wound of His people, restoring them under a new Davidic ruler.',
      '31 (The New Covenant)': 'Describes the joyful return of the exiles and announces a future covenant where God\'s law is written directly on human hearts.',
      '31:1–6 (The Restoration of Israel)': 'God affirms His everlasting love for the nation and promises that the virgin Israel will again plant vineyards and worship on Mount Zion.',
      '31:7–14 (The Joyful Return of the Exiles)': 'The Lord announces the gathering of a remnant from the ends of the earth, including the blind and the lame, who will rejoice in abundance.',
      '31:15–22 (Rachel Weeping for Her Children)': 'A voice of lamentation in Ramah is comforted by God\'s promise that the children will return as Ephraim repents and is received back with compassion.',
      '31:23–30 (Individual Responsibility)': 'God promises to replenish the weary soul and declares that in the coming days, people will be judged for their own iniquity, not their ancestors\'.',
      '31:31–34 (The New Covenant)': 'The Lord establishes a new relationship with His people where the law is written on their hearts, leading to universal knowledge of God and total forgiveness.',
      'Jeremiah 31:31': 'Behold, the days come, says the Lord, that I will make a new covenant with the house of Israel, and with the house of Judah.',
      'Jeremiah 31:32': '"It will not be like the covenant I made with their ancestors when I took them by the hand to lead them out of Egypt, because they broke my covenant, though I was a husband to them," declares the Lord.',
      'Jeremiah 31:33': '"But this is the covenant that I will make with the house of Israel after those days, declares the Lord: I will put my law within them, and I will write it on their hearts; and I will be their God, and they shall be my people."',
      'Jeremiah 31:34': '"No longer will they teach their neighbor, or say to one another, \'Know the Lord,\' because they will all know me, from the least of them to the greatest," declares the Lord, "for I will forgive their wickedness and will remember their sins no more."',
      '31:35–40 (The Eternal Nature of the Covenant)': 'God guarantees the survival of Israel as long as the fixed order of the sun, moon, and stars remains, providing boundaries for the rebuilt holy city.',
      '32 (The Purchase of the Field)': 'While imprisoned during the siege, Jeremiah buys a field in Anathoth to demonstrate God\'s promise that property will again be bought and sold in the land.',
      '33 (The Branch of Righteousness)': 'God reaffirms His eternal commitment to the Davidic line and the Levitical priesthood, promising a righteous Branch who will execute justice.',
      '34–45 (The Fall of Jerusalem)': 'Details of the siege, the burning of Jeremiah\'s scroll by King Jehoiakim, and the eventual destruction of the temple by the Babylonians.',
      '46–51 (Oracles Against the Foreign Nations)': 'Jeremiah prophesies the judgment of surrounding powers, culminating in a massive proclamation of the total fall of Babylon.',
      '52 (Historical Appendix)': 'A historical recount of Jerusalem\'s fall and the exile of its people, ending with the release of King Jehoiachin from prison in Babylon.',
      // Lamentations
      'Lamentations': 'Five poems mourning the destruction of Jerusalem, expressing grief and acknowledging God\'s just judgment.',
      '1 (The Desolation of Jerusalem)': 'The city is personified as a grieving widow, weeping over her abandonment and the bitter suffering caused by her own transgressions.',
      '2 (The Wrath of God)': 'The poet describes the destruction of the Temple and the city as a direct act of divine judgment, emphasizing that God became like an enemy to His people.',
      '3 (The Man of Affliction and Hope)': 'Amidst intense personal suffering, the author expresses a central core of hope in God\'s steadfast love and mercies that are new every morning.',
      '4 (The Horrors of the Siege)': 'The narrative contrasts Jerusalem\'s former glory with the gruesome reality of the famine and degradation during the Babylonian conquest.',
      '5 (A Prayer for Restoration)': 'A collective plea for God to remember His people\'s reproach and to restore their days as of old.',
      // Ezekiel
      'Ezekiel': 'Symbolic visions of God\'s glory, judgment against Israel and the nations, and restoration of a purified people.',
      '1–3 (The Vision of God\'s Glory and Ezekiel\'s Call)': 'Ezekiel sees a celestial chariot of four living creatures by the Chebar canal, where he is commissioned as a watchman for the house of Israel.',
      '4–5 (Signs of the Coming Siege)': 'The prophet performs symbolic acts, including lying on his side and cooking bread over dung, to represent the conditions and judgment awaiting Jerusalem.',
      '6–7 (Prophecies Against the Land and People)': 'God announces the inevitable destruction of Israel\'s idolatrous high places and the end that is coming upon the four corners of the land.',
      '8–11 (The Abominations in the Temple and the Departure of Glory)': 'In a visionary trip to Jerusalem, Ezekiel witnesses secret idolatry inside the Temple, leading to God\'s glory departing the sanctuary.',
      '12–24 (Signs and Parables of Judgment)': 'Through metaphors—including a useless vine, an unfaithful wife, and two eagles—God refutes the people\'s false sense of security and confirms the city\'s fall.',
      '25–32 (Oracles Against the Nations)': 'Divine judgment proclaimed against Ammon, Moab, Edom, and especially the prideful cities of Tyre and Egypt.',
      '25:1–7 (Prophecy Against Ammon)': 'Because Ammon gloated over the desecration of the sanctuary, God promises to hand them over to the people of the East as a possession.',
      '25:8–11 (Prophecy Against Moab)': 'God declares judgment on Moab for claiming Judah is like all other nations, promising to lay open their frontier cities to invaders.',
      '25:12–14 (Prophecy Against Edom)': 'The Lord vows to stretch out His hand against Edom for taking revenge on Judah, executing His vengeance through the hand of Israel.',
      '25:15–17 (Prophecy Against Philistia)': 'Because of the Philistines\' long-standing vengeful hostility, God promises to carry out great acts of judgment in His anger.',
      '26 (Prophecy Against Tyre)': 'A detailed oracle against the wealthy merchant city of Tyre, predicting its total destruction and transformation into a bare rock for fishermen.',
      '27 (A Lament for Tyre)': 'A poetic dirge describing Tyre as a magnificent ship built of the finest materials that eventually sinks into the heart of the sea with all its wealth.',
      '28:1–10 (Prophecy Against the King of Tyre)': 'The Lord rebukes the ruler of Tyre for his pride in claiming to be a god, prophesying his death at the hands of foreigners.',
      '28:11–19 (A Lament for the King of Tyre)': 'A symbolic passage describing the king\'s fall from Eden-like perfection and beauty due to his wickedness and pride.',
      'Ezekiel 28:15': 'You were blameless in your ways from the day you were created till wickedness was found in you.',
      'Ezekiel 28:16': 'Through your widespread trade you were filled with violence, and you sinned. So I drove you in disgrace from the mount of God, and I expelled you, guardian cherub, from among the fiery stones.',
      'Ezekiel 28:17': 'Your heart became proud on account of your beauty, and you corrupted your wisdom because of your splendor; so I threw you to the earth and made a spectacle of you before kings.',
      '28:20–26 (Prophecy Against Sidon and a Promise for Israel)': 'After a brief oracle against Sidon, God promises to gather Israel from the nations and allow them to live securely in their own land.',
      '29:1–16 (Prophecy Against Egypt and Pharaoh)': 'God compares Pharaoh to a great monster lying in the Nile, declaring that Egypt will be defeated and become a lowly kingdom.',
      '29:17–21 (Egypt as Wages for Nebuchadnezzar)': 'The Lord grants Egypt to the King of Babylon as pay for his long, difficult, and ultimately unsuccessful siege of Tyre.',
      '30:1–19 (A Lament for Egypt)': 'A proclamation of the Day of the Lord against Egypt, detailing the fall of its major cities like Memphis and Thebes.',
      '30:20–26 (Pharaoh\'s Broken Arms)': 'God declares He has broken the arm of Pharaoh and will strengthen the arms of the King of Babylon to bring about Egypt\'s downfall.',
      '31 (The Cedar in Lebanon)': 'A parable comparing Egypt to a towering cedar tree surpassing all others in the garden of God but cut down for its arrogance.',
      '32:1–16 (A Lament for Pharaoh)': 'A funeral dirge for Pharaoh, describing his carcass being cast upon the mountains and his blood drenching the land.',
      '32:17–32 (Egypt in the Realm of the Dead)': 'A vivid description of Egypt descending into Sheol to join other fallen nations like Assyria and Elam in the pit.',
      '33 (The Watchman and the Fall of Jerusalem)': 'News arrives that Jerusalem has been struck, transitioning Ezekiel\'s role from a messenger of doom to one of accountability and eventual hope.',
      '34–37 (The Good Shepherd and the Valley of Dry Bones)': 'God promises to replace Israel\'s failed leaders with a Davidic Shepherd and resurrects a valley of bones to signify national restoration.',
      '38–39 (The Prophecy Against Gog of Magog)': 'A final apocalyptic battle describes the defeat of a great northern coalition, demonstrating God\'s holiness over His restored people.',
      '40–48 (The Vision of the New Temple and Land)': 'A detailed architectural plan for a future temple, the return of God\'s glory, and a river of life flowing from the sanctuary to heal the land.',
      // Daniel
      'Daniel': 'God\'s sovereignty over kingdoms, visions of future empires, and faithfulness in the face of persecution.',
      '1 (Daniel and the Three Friends)': 'Daniel and his companions refuse the king\'s food in Babylon and are blessed with wisdom.',
      '2–6 (The Court Tales and God\'s Sovereignty)': 'Nebuchadnezzar\'s dreams, the Fiery Furnace, the Writing on the Wall, and the Lions\' Den demonstrate God\'s rule over earthly kings.',
      '2 (Nebuchadnezzar\'s Dream of the Statue)': 'Daniel receives a divine revelation of a colossus made of four metals destroyed by a stone, symbolizing God\'s eternal kingdom shattering human empires.',
      '3 (The Fiery Furnace)': 'Shadrach, Meshach, and Abednego refuse to worship Nebuchadnezzar\'s golden image and are miraculously preserved by a fourth figure in the flames.',
      'Daniel 3:25': 'He answered and said, "Lo, I see four men loose, walking in the midst of the fire, and they have no hurt; and the form of the fourth is like the Son of God."',
      '4 (The Humbling of Nebuchadnezzar)': 'The king dreams of a great tree being cut down and subsequently suffers madness living like an animal until he acknowledges that the Most High rules.',
      '5 (Belshazzar\'s Feast and the Writing on the Wall)': 'During a blasphemous banquet, a mysterious hand writes a message of judgment that Daniel interprets as the immediate end of the Babylonian Empire.',
      '6 (Daniel in the Lions\' Den)': 'Daniel is cast into a pit of lions for praying to God but is delivered by an angel, resulting in the destruction of his accusers and a proclamation of God\'s dominion.',
      '7 (The Vision of the Four Beasts)': 'Daniel\'s terrifying vision of four great beasts rising from the sea, followed by the Ancient of Days and the Son of Man receiving eternal dominion.',
      '8–9 (The Ram, the Goat, and the Seventy Weeks)': 'The conflict between Persia and Greece, followed by Gabriel\'s prophecy of the Seventy Weeks determining Israel\'s future.',
      '8:1–14 (The Vision of the Ram and the Goat)': 'A two-horned ram representing Media-Persia is defeated by a single-horned goat representing Greece, whose conspicuous horn is broken and replaced by four others.',
      '8:15–27 (The Interpretation by Gabriel)': 'Gabriel explains that a bold and deceitful king will arise from the Grecian succession to oppose the Prince of princes before being broken by non-human hands.',
      '9:1–19 (Daniel\'s Prayer of Confession)': 'After reflecting on Jeremiah\'s prophecy of seventy-year desolation, Daniel offers a passionate corporate confession pleading for God\'s mercy and Jerusalem\'s restoration.',
      '9:20–23 (The Arrival of Gabriel)': 'While Daniel is still praying, Gabriel returns to provide insight and understanding, affirming that Daniel is greatly loved in heaven.',
      '9:24–27 (The Prophecy of the Seventy Weeks)': 'Gabriel reveals a complex timeline of seventy sevens decreed for the people to finish transgression and anoint the Most Holy, involving the arrival and cutting off of an Anointed One.',
      'Daniel 9:26': 'And after threescore and two weeks shall Messiah be cut off, but not for himself; and the people of the prince that shall come shall destroy the city and the sanctuary.',
      '10–12 (The Final Vision and the End of Days)': 'A vast conflict between the Kings of the North and South, ending with the promise of resurrection and final judgment.',
      '10:1–11:1 (Daniel\'s Vision by the Tigris)': 'After three weeks of fasting, Daniel encounters a celestial being who reveals spiritual warfare between angelic princes and explains the understanding of the future.',
      '11:2–20 (Prophecies of Persia and Greece)': 'The rise of Persian kings and the conquest by a mighty Greek king, whose empire fractures into four parts, leading to conflict between the Kings of the South and North.',
      '11:21–35 (The Rise of a Contemptible King)': 'A deceptive and cruel ruler desecrates the sanctuary, abolishes the daily sacrifice, and sets up the abomination that causes desolation, persecuting the faithful.',
      '11:36–45 (The Self-Exalting King)': 'This ruler exalts himself above every god and speaks monstrous things against the God of gods, until he ultimately meets his end with no one to help him.',
      'Daniel 11:45': 'He will pitch his royal tents between the seas at the beautiful holy mountain. Yet he will come to his end, and no one will help him.',
      '12:1–3 (The Time of the End and Resurrection)': 'Michael arises during a time of unprecedented distress, followed by a resurrection where many awake to either everlasting life or everlasting contempt.',
      '12:4–13 (The Sealing of the Prophecy)': 'Daniel sees two others by the river and hears that the wonders will last for a time, times, and half a time, before being told to rest until he rises at the end of days.',
      // Minor Prophets
      'The Minor Prophets (The Twelve)': 'Twelve diverse books delivering oracles of divine judgment, calls for social justice, and promises of future restoration to Israel and surrounding nations.',
      'Hosea': 'God\'s faithful love for unfaithful Israel, portrayed through Hosea\'s marriage to an adulterous wife.',
      '1:1–3:5 (The Marriage of Hosea and Gomer)': 'God commands the prophet to marry an unfaithful woman to serve as a living metaphor for Israel\'s spiritual adultery and God\'s commitment to redeem them.',
      '4:1–10:15 (The Indictment and Judgment of Israel)': 'A series of oracles condemning the nation\'s idolatry, social injustice, and reliance on foreign alliances instead of God.',
      '11 (The Compassion of a Father)': 'God describes His love for Israel as that of a father for a child, expressing divine reluctance to completely abandon His people.',
      '12:1–13:16 (Israel\'s Persistent Rebellion)': 'The prophet reviews the nation\'s history of deception and pride, warning that continued rejection of God will lead to inevitable national destruction.',
      '14 (A Call to Repentance and Promise of Healing)': 'The book concludes with a final plea for Israel to return to the Lord, followed by a beautiful promise of spiritual restoration and flourishing.',
      'Joel': 'A locust plague as a symbol of God\'s judgment, calls for repentance, and promises of restoration and outpouring of the Spirit.',
      '1 (The Plague of Locusts)': 'A devastating locust invasion strips the land of its harvest, prompting Joel to call the community to national mourning and prayer.',
      '2:1–11 (The Coming Day of the Lord)': 'The prophet describes an approaching army using the imagery of a supernatural locust swarm, signaling a terrifying day of divine judgment.',
      '2:12–17 (A Call to Heartfelt Repentance)': 'God urges the people to rend their hearts rather than their garments, promising that He is gracious and merciful to those who return to Him.',
      '2:18–32 (The Promise of Restoration and the Outpouring of the Spirit)': 'In response to repentance, God promises to restore the land\'s fertility and pour out His Spirit on all people, accompanied by celestial signs of deliverance.',
      '3 (The Judgment of the Nations)': 'A vision of God gathering all nations to the Valley of Jehoshaphat for final judgment while Jerusalem is established as a place of eternal safety.',
      'Amos': 'Social justice and judgment against Israel\'s oppression and hypocrisy, calling for repentance and righteous living.',
      '1:1–2:16 (Judgment on the Nations and Israel)': 'Amos begins with oracles against Israel\'s neighbors before announcing even harsher judgment on Israel for their social and religious failures.',
      '3:1–6:14 (Indictments of Social Injustice)': 'Three hear this word messages condemning the wealthy for oppressing the poor and warning that empty religious rituals cannot replace true justice.',
      '3 (The Prophet\'s Responsibility and Samaria\'s Doom)': 'God declares that Israel\'s unique relationship entails unique accountability, signaling the destruction of their luxurious winter and summer houses.',
      '4:1–3 (The Cows of Bashan)': 'Amos delivers a scathing rebuke to the wealthy women of Samaria who exploit the poor to fund their decadence.',
      '4:4–13 (Failure to Learn from Judgment)': 'Despite a series of natural disasters intended to bring the nation to repentance, Israel remains defiant, prompting the warning to prepare to meet your God.',
      '5:1–15 (A Lament and a Call to Seek Good)': 'The prophet raises a funeral dirge for Israel while offering a final plea to seek the Lord and establish justice in the city gates.',
      '5:16–27 (The Day of the Lord and the Rejection of Ritual)': 'Amos warns that the Day of the Lord will be darkness for those who offer religious sacrifices while ignoring social righteousness.',
      'Amos 5:26': 'You have lifted up the shrine of your king, the pedestal of your idols, the star of your god—which you made for yourselves.',
      '6 (The Complacency of the Elite)': 'The leaders lounging on beds of ivory are condemned for their false sense of security, which will lead directly to the nation\'s exile.',
      '7:1–9:10 (Five Visions of Judgment)': 'Amos recounts visions of locusts, fire, a plumb line, a basket of ripe fruit, and the Lord by the altar, all signifying that Israel\'s time for repentance has run out.',
      '9 (The Promise of Future Restoration)': 'The book concludes with a sudden shift to hope, promising a day when the fallen tent of David will be rebuilt and the land will overflow with abundance.',
      'Obadiah': 'Judgment against Edom for their treachery against Israel.',
      '1:1–9 (The Judgment of Edom)': 'The prophet announces that God will bring down Edom from its mountain strongholds, stripping it of its pride and perceived security.',
      '1:10–14 (Edom\'s Crimes Against Israel)': 'Edom\'s destruction results from their violence and gloating when their brother Jacob was being conquered by foreign invaders.',
      '1:15–16 (The Day of the Lord for All Nations)': 'Edom\'s specific judgment becomes a pattern for how God will eventually judge all nations that oppose His people.',
      '1:17–21 (The Restoration of Israel)': 'The book concludes with a vision of Mount Zion as a place of deliverance where the kingdom of the Lord is established over its former enemies.',
      'Jonah': 'God\'s mercy extends to all nations, even enemies, through Jonah\'s reluctant mission and God\'s persistent grace.',
      '1 (The Prophet\'s Disobedience and the Great Fish)': 'After receiving a command to preach to Nineveh, Jonah flees by sea and is swallowed by a massive fish after a divine storm threatens his ship.',
      '2 (Jonah\'s Prayer from the Deep)': 'From the belly of the fish, Jonah offers a poetic prayer of thanksgiving and repentance, acknowledging that salvation belongs to the Lord.',
      '3 (The Conversion of Nineveh)': 'Jonah obeys the second call to preach, leading to an unprecedented national act of repentance that stays God\'s judgment.',
      '4 (Jonah\'s Anger and God\'s Compassion)': 'The book concludes with Jonah\'s frustration over God\'s mercy, prompting a divine lesson about God\'s concern for all people.',
      'Micah': 'Judgment against Israel\'s social injustice and idolatry, with promises of future restoration and a righteous ruler from Bethlehem.',
      '1:1–2:13 (Judgment on Samaria and Judah)': 'Micah announces divine judgment against the capital cities for their persistent idolatry and systemic exploitation of the poor.',
      '3:1–5:15 (The Contrast of Leaders and the Future King)': 'After condemning corrupt priests and prophets, Micah offers hope, prophesying that a ruler will emerge from Bethlehem to shepherd God\'s people.',
      '6:1–7:7 (The Lord\'s Indictment and Israel\'s Corruption)': 'In a courtroom-style dialogue, God reminds Israel of His past faithfulness and clarifies that He desires justice, mercy, and humility over empty rituals.',
      '7:8–20 (A Prayer of Confidence and Divine Forgiveness)': 'A move from lament to trust, celebrating God\'s unique character as one who pardons sin and remains faithful to the promises made to Abraham.',
      'Micah 7:18': 'Who is a God like you, who pardons sin and forgives the transgression of the remnant of his inheritance, who does not stay angry forever but delights to show mercy?',
      'Nahum': 'Judgment against Nineveh, the capital of Assyria, for its violence and oppression.',
      '1 (The Majesty of God in Judgment)': 'The Lord is depicted as a jealous and avenging God whose power over nature ensures the destruction of His enemies and protection of those who trust Him.',
      'Nahum 1:7': 'The Lord is good, a refuge in times of trouble. He cares for those who trust in him.',
      '2 (The Siege and Fall of Nineveh)': 'A vivid, poetic description of the military assault on the Assyrian capital, detailing the chariots, the plundering, and the total collapse of its defenses.',
      '3 (The Reasons for Nineveh\'s Ruin)': 'Nineveh\'s crimes—including cruelty, idolatry, and deception—are listed, and its wound is declared incurable as its fall is cheered by all it oppressed.',
      'Habakkuk': 'Questioning God\'s justice in the face of evil, and learning to trust in God\'s sovereign plan.',
      '1:1–11 (The Prophet\'s First Complaint and God\'s Answer)': 'Habakkuk questions why God allows injustice in Judah, only to be shocked that the even more ruthless Babylonians will be used as an instrument of judgment.',
      '1:12–2:1 (The Prophet\'s Second Complaint)': 'Troubled by a holy God using a wicked nation to punish a relatively righteous one, the prophet takes his stand on a watchtower to await a divine explanation.',
      '2:2–20 (The Five Woes Against the Oppressor)': 'God commands Habakkuk to write down the vision, declaring that the righteous shall live by his faith while pronouncing five woes against the prideful conquerors.',
      '3 (Habakkuk\'s Prayer and Song of Trust)': 'A majestic poetic prayer recalling God\'s past redemptive power, leading the prophet to total joy and trust in God regardless of outward circumstances.',
      'Zephaniah': 'The Day of the Lord\'s judgment against all nations, and the promise of restoration for a humble remnant.',
      '1:1–2:3 (The Coming Day of the Lord)': 'Zephaniah warns of a looming global judgment targeting Judah and Jerusalem for their idolatry and religious complacency.',
      '2:4–15 (Judgment Against the Surrounding Nations)': 'The divine warning extends to neighboring powers—Philistia, Moab, Ammon, Cush, and Assyria—as no prideful nation can escape God\'s sovereignty.',
      '3:1–7 (The Corruption of Jerusalem)': 'The focus returns to the holy city, indicting its leaders, judges, and prophets for their stubborn refusal to trust in God despite witnessing His past judgments.',
      '3:8–20 (The Promise of Restoration and Joy)': 'A vision of a purified remnant from all nations worshiping together and God singing a song of joy over a restored and humble Israel.',
      'Haggai': 'Encouragement to rebuild the temple, promising God\'s blessing and future glory.',
      '1 (The Call to Rebuild the Temple)': 'Haggai confronts the returned exiles for living in paneled houses while God\'s house remains a ruin, leading leaders to restart construction.',
      '2:1–9 (The Promise of Greater Glory)': 'God encourages those who remember Solomon\'s Temple by promising that the glory of this second house will eventually exceed the first through His divine provision.',
      '2:10–19 (A Lesson on Holiness and Blessing)': 'Through a priestly ruling on ritual purity, the prophet explains that past disobedience caused crop failures, but current obedience will bring immediate blessing.',
      '2:20–23 (The Signet Ring of Zerubbabel)': 'The book concludes with a personal messianic promise to Zerubbabel, establishing him as a chosen servant and a signet ring in the line of David.',
      'Zechariah': 'Visions of hope and restoration for Jerusalem, and prophecies of the coming Messiah.',
      '1:1–6 (A Call to Repentance)': 'The prophet opens with a warning based on the failure of previous generations, urging the returned exiles to return to God so that He may return to them.',
      '1:7–6:15 (The Eight Night Visions)': 'A series of highly symbolic visions—including horses, horns, a measuring line, and a flying scroll—revealing God\'s plans to restore Jerusalem and judge her enemies.',
      '7:1–8:23 (True Fasting and the Promise of Blessing)': 'In response to a question about ritual fasting, God demands justice and mercy instead, promising a future where Jerusalem is so blessed that all nations seek the Lord.',
      '9:1–11:17 (The Coming King and the Rejected Shepherd)': 'Oracles describing a humble king entering Jerusalem on a donkey, contrasted with the worthless shepherd who causes the flock to scatter.',
      '12:1–14:21 (The Final Battle and the Kingdom of God)': 'An apocalyptic vision of a global siege against Jerusalem, the mourning for the one they pierced, and the ultimate establishment of God\'s universal reign.',
      'Malachi': 'Rebuke against Israel\'s spiritual apathy and unfaithfulness, with promises of a coming messenger to prepare the way for the Lord.',
      '1:1–5 (God\'s Love for Israel)': 'The prophet begins with a divine declaration of love, contrasting the restoration of Jacob with the permanent desolation of Esau.',
      '1:6–2:9 (The Corruption of the Priesthood)': 'God rebukes the priests for offering defiled sacrifices and failing to teach the Law, warning that their blessings will be turned into curses.',
      '2:10–16 (Faithlessness in the Community)': 'Malachi condemns the people for social treachery, specifically addressing intermarriage with idolaters and the prevalence of divorce.',
      '2:17–3:5 (The Coming Messenger and Judgment)': 'A messenger will prepare the way for the Lord\'s sudden and refining arrival at the Temple, responding to those who question God\'s justice.',
      '3:6–12 (Robbing God)': 'The people are challenged to return to God through faithful tithing, with a promise that the windows of heaven will be opened for those who obey.',
      '3:13–4:3 (The Book of Remembrance and the Sun of Righteousness)': 'God distinguishes between those who fear Him and those who are arrogant, promising a day when the righteous will triumph like the rising sun.',
      '4:4–6 (The Final Admonition)': 'The Old Testament concludes with a call to remember the Law of Moses and a prophecy that Elijah will return to restore family relationships before the great day of the Lord.',
      'Historical Books': 'Summarizes Israel\'s history after Moses, focusing on their conquest of Canaan, the era of the Judges, the establishment and division of the monarchy, and the subsequent cycles of sin, judgment, and exile, concluding with their return and rebuilding efforts.',
      'Joshua': 'God fulfills promises through obedient faith, establishing Israel in Canaan.',
      '1:1–5:12 (Entering the Promised Land)': 'Following the death of Moses, Joshua leads Israel across the miraculously parted Jordan River and circumcises the new generation at Gilgal.',
      '1:1–9 (The Commissioning of Joshua)': 'After the death of Moses, the Lord commands Joshua to cross the Jordan and take the land, promising His presence and exhorting him to be strong, courageous, and meditatively obedient to the Law.',
      'Josh 1:9': 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',
      '1:10–18 (Preparation for the Crossing)': 'Joshua instructs the officers to prepare provisions and reminds the Transjordanian tribes of their pledge to help their brothers conquer the land before settling their own territory.',
      '2 (Rahab and the Spies)': 'Two spies are sent to Jericho where they are hidden by Rahab the prostitute, who confesses her faith in Israel\'s God and receives a promise of safety marked by a scarlet cord.',
      '3 (Crossing the Jordan)': 'The priests carry the Ark of the Covenant into the Jordan River, causing the waters to stop in a heap and allowing all Israel to cross on dry ground.',
      'Josh 3:16': 'The water from upstream stopped flowing. It piled up in a heap a great distance away, at a town called Adam in the vicinity of Zarethan, while the water flowing down to the Sea of the Arabah was completely cut off. So the people crossed over opposite Jericho.',
      '4 (The Twelve Memorial Stones)': 'God instructs Joshua to have twelve men take stones from the dry riverbed to set up a permanent memorial at Gilgal to teach future generations about the Lord\'s power.',
      '5:1–9 (Circumcision at Gilgal)': 'Before the first battle, the new generation of Israelites born in the wilderness is circumcised at Gibeath Haaraloth to "roll away the reproach of Egypt."',
      '5:10–12 (The First Passover and the End of Manna)': 'The Israelites celebrate Passover on the plains of Jericho, and the day after they eat the produce of Canaan, the miraculous manna finally ceases.',
      '5:13–12:24 (The Conquest of Canaan)': 'The Israelite army conducts a series of military campaigns, beginning with the fall of Jericho and concluding with the defeat of thirty-one regional kings.',
      '5:13–6 (The Fall of Jericho)': 'After Joshua encounters the Commander of the Lord\'s army, the Israelites march around Jericho for seven days until the walls collapse at the blast of trumpets and a great shout.',
      '7–8:29 (The Sin of Achan and the Conquest of Ai)': 'Israel is initially defeated at Ai due to Achan\'s theft of devoted goods, but after his execution, Joshua uses an ambush strategy to utterly destroy the city.',
      '8:30–35 (Covenant Renewal at Mount Ebal)': 'Joshua builds an altar and writes a copy of the Law on stones, reading all the blessings and cursings to the entire assembly of Israel as Moses had commanded.',
      '9 (The Gibeonite Deception)': 'Fearing destruction, the Gibeonites trick Joshua into a peace treaty by pretending to be from a distant land, leading Israel to spare them as woodcutters and water carriers.',
      '10 (The Southern Campaign)': 'God makes the sun stand still to aid Israel in defeating a five-king Amorite coalition, followed by a rapid conquest of various southern Canaanite royal cities.',
      'Josh 10:39': 'He took it, its king and all its villages, and they put them to the sword and totally destroyed everyone in it, leaving no survivors; he did to Debir and its king as he had done to Libnah and its king and to Hebron.',
      '11 (The Northern Campaign)': 'Joshua defeats a massive northern alliance led by Jabin of Hazor at the Waters of Merom, effectively breaking the major organized military resistance in the land.',
      '12 (List of Defeated Kings)': 'This section provides a detailed summary of the thirty-one kings defeated by Moses east of the Jordan and by Joshua to the west.',
      '13:1–21:45 (The Allotment of the Land)': 'Joshua oversees the distribution of the conquered territories among the twelve tribes, including the designation of Cities of Refuge and Levitical towns.',
      '22:1–24:33 (Joshua\'s Farewell and Covenant Renewal)': 'Before his death, Joshua exhorts the nation to remain faithful to the Lord and leads them in a formal ceremony to renew their covenant at Shechem.',
      'Judges': 'Cycles of disobedience, oppression, and God\'s deliverance through flawed leaders.',
      '1–3:6 (The Cycle of Apostasy)': 'After the death of Joshua\'s generation, Israel repeatedly falls into idolatry, prompting a cycle of divine judgment, repentance, and deliverance.',
      '3:7–31 (The Deliverance by the Judges)': 'God raises up diverse leaders, including Deborah, Gideon, and Samson, to rescue the tribes from various oppressive neighboring nations.',
      '17–18 (The Idolatry of Micah and the Danites)': 'A narrative about a private shrine and the migration of the tribe of Dan illustrates the religious confusion and lawlessness of the period.',
      '19–21 (The Outrage at Gibeah and the Civil War)': 'The brutal mistreatment of a Levite\'s concubine triggers a near-extinction of the tribe of Benjamin and highlights a society where everyone did what was right in their own eyes.',
      'Ruth': 'Loyalty and redemption within a lineage leading to King David.',
      '1 (Naomi and Ruth Return to Bethlehem)': 'After the death of her husband and sons in Moab, Naomi returns to her homeland accompanied by her loyal daughter-in-law Ruth, who pledges her life to Naomi\'s God and people.',
      '2 (Ruth Gleans in the Field of Boaz)': 'While seeking food to survive, Ruth providentially works in the field of a wealthy relative named Boaz, who shows her extraordinary kindness and protection.',
      '3 (The Request at the Threshing Floor)': 'Following Naomi\'s advice, Ruth approaches Boaz at night to request that he act as her kinsman-redeemer by marrying her and preserving her family\'s inheritance.',
      '4:1–12 (Boaz Redeems Ruth)': 'Boaz legally secures the right of redemption at the city gate after a closer relative declines, clearing the way for him to take Ruth as his wife.',
      '4:13–22 (The Genealogy of David)': 'The story concludes with the birth of Obed, the grandfather of King David, revealing how Ruth\'s faithfulness integrated her into the royal lineage of Israel.',
      '1 Samuel': 'Transition from judges to monarchy; Saul\'s rise and fall, David\'s emergence.',
      '1–3 (The Birth and Calling of Samuel)': 'God answers Hannah\'s prayer for a son, and the boy Samuel grows up in the Tabernacle to become a prophet during a time when the word of the Lord was rare.',
      '4–7 (The Ark Narrative and Samuel\'s Judgeship)': 'After the Philistines capture the Ark of the Covenant and return it due to divine plagues, Samuel leads Israel to a decisive spiritual and military victory at Mizpah.',
      '8–12 (The Establishment of the Monarchy)': 'Yielding to the people\'s demand for a king, Samuel anoints Saul and warns the nation about the rights and responsibilities of human kingship.',
      '13–15 (The Rise and Fall of Saul)': 'Saul wins early military victories but is eventually rejected by God as king after twice disobeying direct divine commands.',
      '16–17 (The Anointing of David and Victory over Goliath)': 'Samuel secretly anoints the shepherd boy David, who subsequently gains national fame by defeating the Philistine giant in single combat.',
      '16:1–13 (David Anointed by Samuel)': 'God sends Samuel to Bethlehem to anoint a new king among the sons of Jesse, where David is chosen over his elder brothers.',
      '16:14–23 (David in Saul\'s Service)': 'An evil spirit torments Saul, leading his servants to bring in David, whose skillful harp playing provides the king relief and earns him a place as an armor-bearer.',
      '17:1–11 (Goliath\'s Challenge)': 'The Philistine giant Goliath defies the armies of Israel for forty days, demanding a champion to face him in single combat.',
      '17:32–40 (David Accepts the Challenge)': 'While bringing food to his brothers, David hears Goliath\'s defiance and, fueled by faith, convinces Saul that he can kill the giant just as he killed lions and bears.',
      '17:41–54 (David Kills Goliath)': 'Refusing Saul\'s heavy armor, David uses a sling and five smooth stones to strike Goliath in the forehead, leading to a total rout of the Philistine army.',
      '1Sam 17:57': 'As soon as David returned from killing the Philistine, Abner took him and brought him before Saul, with David still holding the Philistine\'s head.',
      '18–20 (The Friendship of Jonathan and Saul\'s Jealousy)': 'As David\'s popularity grows, King Saul becomes consumed by murderous envy, while his son Jonathan forms a deep, protective bond with David.',
      '21–26 (David\'s Life as a Fugitive)': 'David flees from Saul\'s court and leads a band of outlaws in the wilderness, twice sparing Saul\'s life to demonstrate his refusal to harm "the Lord\'s anointed."',
      '27–31 (The End of Saul\'s Reign)': 'Seeking refuge among the Philistines, David continues to prosper while a desperate Saul consults a medium and ultimately dies in battle on Mount Gilboa.',
      '2 Samuel': 'David\'s reign, both triumphs and sins, and the establishment of his kingdom.',
      '1 (David\'s Lament for Saul and Jonathan)': 'David receives news of the Israelite defeat on Mount Gilboa and composes a poignant song of mourning for the fallen king and his beloved friend.',
      '2–4 (The Struggle Between David and the House of Saul)': 'David is anointed king of Judah while Ish-bosheth is made king over Israel, leading to a period of civil war that ends with the assassination of Saul\'s last surviving heir.',
      '5–6 (David Becomes King and Brings the Ark to Jerusalem)': 'All the tribes of Israel unite under David\'s rule, and he successfully captures Jerusalem to establish it as the nation\'s political and religious capital.',
      '7 (The Davidic Covenant)': 'God denies David\'s request to build a temple but promises to establish his throne and lineage as an everlasting dynasty.',
      '2Sam 7:28': 'Sovereign Lord, you are God! Your covenant is trustworthy, and you have promised these good things to your servant.',
      '8–10 (David\'s Military Victories and Kindness to Mephibosheth)': 'Israel expands its borders through numerous conquests, while David fulfills his oath to Jonathan by providing for his crippled son.',
      '11–12 (David\'s Sin with Bathsheba and Its Consequences)': 'David commits adultery and murder, leading to a divine confrontation through the prophet Nathan and the subsequent death of his child.',
      '13–14 (The Rebellion of Absalom Begins)': 'Internal strife fractures David\'s family as Amnon\'s crime leads to Absalom\'s revenge and his eventual return to Jerusalem.',
      '15–19 (Absalom\'s Coup and David\'s Flight)': 'Absalom seizes the throne and forces David into exile, but the rebellion is crushed and Absalom is killed, leaving David in deep grief.',
      '20 (The Rebellion of Sheba)': 'A second uprising occurs among the northern tribes but is quickly suppressed, further stabilizing David\'s restored authority.',
      '21–24 (Appendices to David\'s Reign)': 'The book concludes with a collection of narratives including a famine, David\'s song of praise, and a census that leads to the purchase of the site for the future temple.',
      '1 Kings': 'Solomon\'s wisdom and decline, the kingdom\'s division, and the rise of prophets.',
      '1–2 (The Accession of Solomon)': 'Following a brief struggle for succession against Adonijah, Solomon is established as king and carries out David\'s final instructions to secure the throne.',
      '3–4 (Solomon\'s Wisdom and Prosperity)': 'God grants Solomon unparalleled wisdom and wealth, resulting in a period of peace and international renown for the kingdom of Israel.',
      '5–9:9 (The Building and Dedication of the Temple)': 'Solomon utilizes resources from Tyre to construct a magnificent temple for the Lord in Jerusalem, which is then consecrated with a massive celebration and divine blessing.',
      '9:10–11:43 (Solomon\'s Splendor and Decline)': 'Despite his achievements and the visit from the Queen of Sheba, Solomon\'s many foreign wives lead him into idolatry, prompting God to announce the future division of the kingdom.',
      '9:10–28 (Solomon\'s Further Building Projects)': 'After twenty years of construction, Solomon settles debts with King Hiram of Tyre and uses forced labor to fortify cities like Hazor, Megiddo, and Gezer.',
      '10:1–13 (The Visit of the Queen of Sheba)': 'The Queen of Sheba travels to Jerusalem to test Solomon\'s wisdom with hard questions and is overwhelmed by his immense wealth and the order of his court.',
      '10:14–29 (Solomon\'s Great Wealth)': 'Detailed accounts describe the king\'s annual revenue of gold, his throne of ivory and gold guarded by twelve lions, and his extensive trade in chariots and horses.',
      '11:1–13 (Solomon\'s Apostasy)': 'Solomon\'s love for many foreign women leads him to worship other gods like Ashtoreth and Molech, prompting God to declare that the kingdom will be torn away from his son.',
      '1Kgs 11:4': 'As Solomon grew old, his wives turned his heart after other gods, and his heart was not fully devoted to the Lord his God, as the heart of David his father had been.',
      '1Kgs 11:5': 'For Solomon went after Ashtoreth the goddess of the Sidonians, and after Milcom the abomination of the Ammonites.',
      '1Kgs 11:6': 'So Solomon did evil in the eyes of the Lord; he did not follow the Lord completely, as David his father had done.',
      '1Kgs 11:7': 'On a hill east of Jerusalem, Solomon built a high place for Chemosh the detestable god of Moab, and for Molech the detestable god of the Ammonites.',
      '1Kgs 11:8': 'He did the same for all his foreign wives, who burned incense and offered sacrifices to their gods.',
      '11:14–40 (Solomon\'s Adversaries)': 'God raises up external enemies like Hadad the Edomite and Rezon of Damascus, along with the internal threat of Jeroboam, to whom the prophet Ahijah promises ten tribes of Israel.',
      '11:41–43 (The Death of Solomon)': 'Following a forty-year reign over all Israel, Solomon dies and is buried in the City of David, leaving his son Rehoboam to succeed him.',
      '12–14 (The Division of the Kingdom)': 'Under Rehoboam\'s harsh leadership, the ten northern tribes secede to form the Kingdom of Israel under Jeroboam, who establishes rival golden calf shrines.',
      '15–16 (The Early Kings of Judah and Israel)': 'The narrative briefly charts the reigns of several kings in both the north and south, characterized by frequent warfare and varying degrees of spiritual faithfulness.',
      '17–19 (The Ministry of Elijah)': 'The prophet Elijah emerges to challenge the pagan worship of Baal, most notably during a miraculous showdown on Mount Carmel against the prophets of Jezebel.',
      '20–22:40 (The Wars and Death of Ahab)': 'King Ahab engages in multiple conflicts with Syria and is ultimately killed in battle exactly as Elijah had prophesied.',
      '22:41–53 (The Reigns of Jehoshaphat and Ahaziah)': 'The book concludes with a summary of Jehoshaphat\'s relatively righteous rule in Judah and the brief, wicked reign of Ahaziah in Israel.',
      '2 Kings': 'Continued decline of Israel and Judah, exile, and the consequences of idolatry.',
      '1–2:18 (The Transition from Elijah to Elisha)': 'Elijah is taken to heaven in a whirlwind, leaving his prophetic mantle and a double portion of his spirit to his successor, Elisha.',
      '1:1–8 (Ahaziah\'s Sickness and Message)': 'After King Ahaziah of Israel is injured in a fall, he seeks an oracle from Baal-Zebub, prompting Elijah to intercept the messengers with a word of judgment from the Lord.',
      '1:9–16 (Fire from Heaven)': 'Ahaziah sends three groups of fifty soldiers to arrest Elijah, the first two of which are consumed by fire from heaven before the third captain begs for mercy.',
      '2Kgs 1:10': 'Elijah answered the captain, "If I am a man of God, may fire come down from heaven and consume you and your fifty men!" Then fire fell from heaven and consumed the captain and his men.',
      '2Kgs 1:11': 'At this the king sent to him another captain with his fifty men. The captain said to him, "Man of God, this is what the king says, \'Come down at once!\'"',
      '2Kgs 1:12': '"If I am a man of God," Elijah replied, "may fire come down from heaven and consume you and your fifty men!" Then the fire of God fell from heaven and consumed him and his fifty men.',
      '1:17–18 (Death of Ahaziah)': 'Following Elijah\'s prophecy, Ahaziah dies without a son and is succeeded by his brother Joram, marking the end of his brief and unfaithful reign.',
      '2:1–6 (The Journey to the Jordan)': 'Elijah travels from Gilgal to Bethel, Jericho, and finally the Jordan River, repeatedly testing Elisha\'s loyalty as Elisha refuses to leave his master\'s side.',
      '2:7–12 (Elijah Taken to Heaven)': 'After Elijah strikes the Jordan with his cloak to part the waters, he is taken up to heaven in a whirlwind with a chariot of fire, while Elisha receives a double portion of his spirit.',
      '2:13–18 (Elisha Confirmed as Successor)': 'Elisha picks up Elijah\'s fallen cloak, parts the Jordan himself, and is recognized as the new prophet by the company of prophets from Jericho.',
      '2:19–8:15 (The Miracles and Ministry of Elisha)': 'Elisha performs numerous wonders, including multiplying oil, raising a child from the dead, and healing Naaman the Syrian of leprosy.',
      '2:19–25 (Healing of the Water and the Curse of the Lads)': 'Elisha heals the polluted spring of Jericho with salt but later calls down a curse on mocking youths, leading to two bears mauling forty-two of them.',
      '2Kgs 2:23': 'From there Elisha went up to Bethel, and as he was walking along the road, some boys came out of the town and jeered at him, "Get out of here, baldy!" they said, "Get out of here, baldy!"',
      '2Kgs 2:24': 'He turned around, looked at them and called down a curse on them in the name of the Lord. Then two bears came out of the woods and mauled forty-two of the boys.',
      '3 (The War Against Moab)': 'Elisha provides a miraculous supply of water in the desert for the allied kings of Israel, Judah, and Edom, leading to a decisive victory over the rebellious Moabites.',
      '4 (Miracles for the Needy and Faithful)': 'Elisha multiplies a widow\'s oil, intercedes for the Shunammite woman to have a son (and later raises him from the dead), purifies a poisonous stew, and feeds one hundred men with twenty loaves.',
      '5 (The Healing of Naaman)': 'The Syrian commander Naaman is cured of leprosy by washing in the Jordan, while Elisha\'s servant Gehazi is struck with the disease for his greed.',
      '6–7 (Aramean Wars and the Siege of Samaria)': 'Elisha causes an ax head to float, blinds an Aramean army with prayer, and later predicts the sudden end of a horrific famine in besieged Samaria.',
      '8 (The Shunammite\'s Land and Hazael\'s Usurpation)': 'Elisha ensures the return of the Shunammite\'s property and travels to Damascus to tell Hazael he will become king of Aram after the death of Ben-Hadad.',
      '8:16–12 (Political Turmoil in Judah and Israel)': 'The narrative tracks the reigns of several kings, including the bloody coup of Jehu in the north and the survival and restoration of Joash in the south.',
      '13–14 (The Death of Elisha and Expansion)': 'Elisha passes away during the reign of Jehoash, while both kingdoms experience a brief period of territorial recovery and military success.',
      '15–17 (The Fall of the Northern Kingdom)': 'Following a period of rapid succession and persistent idolatry, the Kingdom of Israel is conquered and its people are deported by the Assyrian Empire.',
      '18–20 (The Reign of Hezekiah)': 'One of Judah\'s most righteous kings enacts religious reforms and witnesses a miraculous divine deliverance from the Assyrian siege of Jerusalem.',
      '21–23:30 (Manasseh\'s Sin and Josiah\'s Reformation)': 'After the extreme wickedness of Manasseh, young King Josiah rediscovers the Book of the Law and initiates a final, sweeping spiritual purge.',
      '23:31–25 (The Fall of the Southern Kingdom)': 'Judah\'s remaining kings fail to sustain Josiah\'s reforms, leading to the Babylonian conquest, the destruction of the Temple, and the exile of the people.',
      '1 Chronicles': 'Genealogies and David\'s reign, focusing on his righteous acts and preparations for the temple.',
      '1–9 (The Ancestries of Israel)': 'Detailed genealogies trace the lineage of humanity from Adam through the tribes of Israel, focusing specifically on the royal line of David and the priestly line of Levi.',
      '10 (The Death of Saul)': 'The narrative briefly recounts the tragic end of Saul\'s reign on Mount Gilboa, emphasizing that his downfall was a result of unfaithfulness to the Lord.',
      '11–12 (David\'s Mighty Men and Rise to Power)': 'After being anointed king at Hebron, David captures Jerusalem and gathers a formidable army of loyal warriors from all the tribes.',
      '13–16 (Bringing the Ark to Jerusalem)': 'David successfully relocates the Ark of the Covenant to a tent in Jerusalem, establishing a permanent system of choral and instrumental worship.',
      '17 (The Covenant with David)': 'In response to David\'s desire to build a permanent temple, God promises to establish his dynastic line forever.',
      '18–20 (The Victories of David)': 'A summary of David\'s military campaigns shows how he secured Israel\'s borders by defeating the Philistines, Moabites, Syrians, and Edomites.',
      '21–22:1 (The Census and the Altar)': 'David\'s unauthorized census leads to a plague, but his subsequent sacrifice at the threshing floor of Ornan identifies the future site of the Temple.',
      '22:2–29 (Preparations for the Temple and Solomon\'s Accession)': 'David spends his final years organizing the Levites, gathering vast resources for construction, and publicly charging Solomon and the leaders to build the house of God.',
      '2 Chronicles': 'Judah\'s history from Solomon to exile, emphasizing kings\' faithfulness (or lack thereof) to God.',
      '1 (Solomon\'s Wisdom and Wealth)': 'Solomon affirms his leadership at Gibeon by asking God for wisdom to govern Israel, receiving both discernment and immense material prosperity.',
      '2–7 (The Construction and Dedication of the Temple)': 'The narrative focuses extensively on the building of the sanctuary and the dramatic descent of God\'s glory during the inaugural prayer and sacrifices.',
      '8–9 (The Zenith of Solomon\'s Reign)': 'Solomon completes his major building projects and receives the Queen of Sheba, marking the peak of Israel\'s international influence before his death.',
      '10–12 (The Division and the Reign of Rehoboam)': 'The kingdom splits due to Rehoboam\'s pride, leading to the establishment of the Southern Kingdom of Judah and its initial struggles with Egyptian invasion.',
      '13–16 (The Reigns of Abijah and Asa)': 'These kings experience military success and spiritual reform when they rely on God, though Asa\'s reign ends with a lapse in faith.',
      '17–20 (The Reforms and Victories of Jehoshaphat)': 'A period of significant spiritual renewal occurs as Jehoshaphat sends teachers of the Law throughout Judah and witnesses a miraculous victory over a coalition of enemies.',
      '21–28 (The Cycle of Faithfulness and Apostasy)': 'Judah cycles through various kings, including the wicked Athaliah and the reforming Joash, illustrating the direct link between the king\'s obedience and the nation\'s welfare.',
      '29–32 (The Great Reformation of Hezekiah)': 'Hezekiah cleanses the Temple, restores the Passover, and successfully resists the Assyrian siege through fervent prayer and trust in God.',
      '33–35 (From Manasseh to Josiah\'s Revival)': 'Following the unprecedented evil and eventual repentance of Manasseh, King Josiah leads the nation\'s final great return to the Mosaic Law.',
      '36 (The Exile and the Decree of Cyrus)': 'The book ends with the destruction of Jerusalem by the Babylonians and a concluding note of hope as King Cyrus of Persia decrees the return of the exiles.',
      'Ezra': 'Return from exile, rebuilding the temple, and restoring the Law.',
      '1–2 (The Decree of Cyrus and the Return of the Exiles)': 'King Cyrus of Persia fulfills prophecy by allowing the Jews to return to Jerusalem to rebuild the Temple, accompanied by a detailed list of those who made the journey.',
      '3–6 (The Rebuilding and Dedication of the Second Temple)': 'Under the leadership of Zerubbabel and Jeshua, the returning exiles overcome local opposition to complete the sanctuary, celebrating its dedication with great joy.',
      '7–8 (Ezra\'s Arrival in Jerusalem)': 'Artaxerxes sends Ezra, a priest and scribe skilled in the Law, to Jerusalem with resources and authority to teach the statutes of God to the people.',
      '9–10 (The Problem of Intermarriage and Spiritual Reform)': 'Ezra leads the community in a profound act of public repentance and separation from foreign influences to preserve their covenant identity.',
      'Nehemiah': 'Rebuilding Jerusalem\'s walls, restoring community, and renewing covenant faithfulness.',
      '1 (Nehemiah\'s Prayer)': 'Upon hearing of Jerusalem\'s ruin, Nehemiah confesses the sins of Israel and petitions God for favor before the Persian king.',
      '2:1–8 (Nehemiah Sent to Jerusalem)': 'King Artaxerxes grants Nehemiah permission, provisions, and safe passage to return to Judah and rebuild the city.',
      '2:9–20 (Nehemiah Inspects the Walls)': 'After a secret nighttime survey of the ruins, Nehemiah rallies the local leaders to begin the rebuilding effort despite foreign opposition.',
      '3 (Builders of the Wall)': 'This detailed record lists the various families, professionals, and leaders who worked side-by-side on specific sections of the gates and walls.',
      '4 (Opposition to the Rebuilding)': 'Nehemiah arms the laborers and sets a constant watch to protect the project from the threats and ridicule of Sanballat and Tobiah.',
      '5 (Nehemiah Helps the Poor)': 'To stop internal exploitation, Nehemiah rebukes the nobles for charging usury and models generosity by refusing his governor\'s food allowance.',
      '6 (Further Plots and Completion)': 'Despite assassination plots and false rumors intended to terrify him, Nehemiah finishes the wall in just fifty-two days.',
      '7 (The List of Exiles)': 'With the city secure, Nehemiah appoints guards and records the genealogy of the people who first returned from Babylon.',
      '8 (Ezra Reads the Law)': 'The people gather at the Water Gate to hear Ezra read the Torah, leading to a national day of mourning followed by the Feast of Booths.',
      '9 (A Public Confession)': 'The Israelites fast and offer a lengthy prayer recounting God\'s faithfulness throughout history despite their ancestors\' persistent rebellion.',
      '10 (The Agreement of the People)': 'The leaders and the community place their seals on a written covenant to faithfully support the temple and obey God\'s commands.',
      '11–12:26 (Resettling and Priestly Lists)': 'These chapters document the families chosen to live in Jerusalem and provide the lineages of the priests and Levites.',
      '12:27–47 (Dedication of the Wall)': 'Nehemiah organizes two large choirs to march atop the walls in a joyful celebration of the project\'s completion.',
      '13 (Nehemiah\'s Final Reforms)': 'Returning after an absence, Nehemiah aggressively corrects abuses regarding the temple, the Sabbath, and foreign intermarriage.',
      'Esther': 'God\'s unseen providence delivers the Jewish people from annihilation.',
      '1–2:18 (The Rise of Esther)': 'After Queen Vashti is deposed for disobedience, a young Jewish orphan named Esther is selected in a royal search to become the new queen of the Persian Empire.',
      '2:19–3 (Haman\'s Plot Against the Jews)': 'Mordecai discovers a conspiracy against the King, but the narcissistic official Haman becomes enraged by Mordecai\'s refusal to bow and secures a royal decree to annihilate all Jews.',
      '4–5 (Esther\'s Intervention)': 'Encouraged by Mordecai to use her position "for such a time as this," Esther risks her life by approaching King Ahasuerus unsummoned to invite him and Haman to a series of banquets.',
      '6–7 (The Fall of Haman)': 'In a dramatic turn of events, the King honors Mordecai for his past loyalty while Esther exposes Haman\'s genocidal plot, leading to Haman\'s execution on the very gallows he built for Mordecai.',
      '8–10 (The Deliverance and Festival of Purim)': 'The King issues a new decree allowing the Jews to defend themselves, resulting in a great victory that is commemorated annually through the Feast of Purim.',
      'Poetic/Wisdom Books': 'Five books exploring life\'s fundamental questions, providing guidance on living wisely, contemplating suffering and divine justice, and offering expressions of worship.',
      // Job
      'Job': 'A dramatic dialogue exploring the suffering of the righteous, the questioning of divine justice, and the mystery of God\'s wisdom.',
      '1–2 (The Prologue)': 'A prose narrative introducing Job\'s righteousness and the heavenly wager that sets in motion his catastrophic trials.',
      '1:1–5 (Job\'s Prosperity and Piety)': 'Job is introduced as a blameless and exceptionally wealthy man who consistently offers sacrifices to ensure his children remain righteous.',
      '1:6–12 (The First Heavenly Council)': 'Satan challenges Job\'s motives before God, arguing that Job is only faithful because he is blessed, leading God to permit a test.',
      '1:13–22 (The First Trial of Job)': 'Job loses his livestock, servants, and all ten children in rapid catastrophes but responds with worship rather than cursing God.',
      '2:1–6 (The Second Heavenly Council)': 'Satan claims a man will endure anything to save his own skin, prompting God to allow a second test that strikes Job\'s physical health.',
      '2:7–13 (The Second Trial and Silent Friends)': 'Afflicted with painful boils, Job sits in ashes until his three friends arrive to mourn with him in seven days of silence.',
      '3–31 (The Dialogue Cycles)': 'A series of three poetic debates between Job and his three friends regarding the origins of suffering and divine justice.',
      '3 (Job\'s Lament)': 'Job breaks his silence by cursing the day of his birth and longing for the peace of death.',
      '4–14 (The First Cycle of Speeches)': 'Eliphaz, Bildad, and Zophar argue that suffering results from sin, while Job maintains his innocence and pleads for a hearing with God.',
      '15–21 (The Second Cycle of Speeches)': 'The friends intensify their descriptions of the fate of the wicked, while Job expresses his feeling of abandonment by both God and man.',
      '22–27 (The Third Cycle of Speeches)': 'Eliphaz makes direct accusations against Job, leading to Job\'s final defense of his integrity and a discourse on the destiny of the wicked.',
      '22 (Eliphaz\'s Third Speech)': 'Eliphaz accuses Job of specific social sins—mistreating widows and orphans—and urges him to submit to God for restoration.',
      '23–24 (Job\'s Sixth Response)': 'Job expresses his desperate desire to find God\'s dwelling to present his case while lamenting that God seemingly ignores widespread injustice.',
      '25 (Bildad\'s Third Speech)': 'In a brief final rebuttal, Bildad emphasizes God\'s absolute dominion and questions how any mortal can be pure before the Almighty.',
      '25:1–3 (The Dominion of God)': 'Bildad asserts that God holds absolute power in the heights of heaven, where his vast celestial armies are beyond counting.',
      '25:4–6 (The Insignificance of Man)': 'The speech questions how a mortal can be righteous before a God who finds even the moon and stars lacking in purity.',
      'Job 25:6': 'How much less a mortal, who is but a maggot—a human being, who is only a worm!',
      '26 (Job\'s Reply to Bildad)': 'Job mocks his friend\'s lack of helpfulness before launching into praise of God\'s majestic and unsearchable power over the heavens and underworld.',
      '27 (Job\'s Final Protest)': 'Job maintains his steadfast refusal to admit wrongdoing, affirming his integrity while describing the bleak judgment that awaits the wicked.',
      '28 (The Interlude on Wisdom)': 'A poetic meditation contrasts human technical ingenuity in mining with the hidden, divine nature of true wisdom.',
      '29–31 (Job\'s Final Appeal)': 'Job contrasts his past honor and prosperity with his current misery, ending with a formal oath of innocence regarding his moral conduct.',
      '32–37 (The Elihu Speeches)': 'A lengthy intervention by a younger fourth counselor who asserts God\'s sovereignty and the educational purpose of suffering.',
      '38–41 (The Divine Speeches)': 'God\'s direct response to Job from the whirlwind, highlighting the incomprehensible mysteries of creation.',
      '38 (The Lord Answers Job from the Whirlwind)': 'God challenges Job\'s understanding of the cosmos through rhetorical questions about the foundations of the earth and sky.',
      '38:1–3 (The Divine Challenge)': 'God breaks his silence by speaking from a whirlwind to demand that Job prepare himself for a direct confrontation.',
      '38:4–11 (Foundations of the Earth and Sea)': 'Rhetorical questions probe Job\'s absence at the measurement of the world and the setting of the ocean\'s boundaries.',
      'Job 38:4': 'Where were you when I laid the earth\'s foundation? Tell me, if you understand.',
      '38:12–15 (The Dawn and the Wicked)': 'God asks whether Job has ever commanded the morning to light the earth so that the wicked might be shaken from its corners.',
      '38:16–21 (The Deep and the Dark)': 'The challenge shifts to the hidden realms of the underworld, the gates of death, and the dwelling places of light and darkness.',
      '38:22–30 (The Storehouses of Weather)': 'God interrogates Job regarding the origins of snow, hail, rain, and ice, which are reserved for times of trouble and battle.',
      '38:31–33 (The Governance of the Stars)': 'The discourse asks whether Job can bind the chains of the Pleiades or lead out the constellations in their seasons.',
      '38:34–41 (The Provision for Wild Animals)': 'The chapter asks whether Job provides prey for the lions or feeds the ravens when their young cry out for food.',
      '39 (The Wonders of the Animal Kingdom)': 'Rhetorical questions highlight the wild instincts of creatures like the mountain goat, the wild donkey, and the hawk.',
      '40:1–14 (Job\'s Humility and God\'s Renewed Challenge)': 'Job acknowledges his insignificance, leading God to challenge him to demonstrate divine power over the proud and the wicked.',
      '40:15–24 (The Description of Behemoth)': 'God describes a massive, powerful land creature with bones like tubes of bronze as a testament to His creative might.',
      '41 (The Description of Leviathan)': 'The discourse concludes with a detailed portrayal of a terrifying and invincible sea monster that no human can tame.',
      '42 (The Epilogue)': 'A prose conclusion detailing Job\'s submission, his intercession for his friends, and the full restoration of his fortunes.',
      // Psalms
      'Psalms': 'A collection of 150 diverse poems, prayers, and hymns offering a wide range of emotions, themes, and spiritual experiences.',
      '1–41 (Book I: Genesis Comparison)': 'Primarily Davidic psalms focusing on God\'s relationship with individuals, concluding with a doxology praising the God of Israel.',
      '1–2 (Introduction to the Psalter)': 'Two preface psalms contrasting the path of the righteous who delight in the law with the futility of nations rebelling against God\'s anointed King.',
      '3–18 (David\'s Conflict and Deliverance)': 'Davidic prayers focused on external threats from enemies, concluding with a grand song of thanks for God\'s saving strength.',
      '19–24 (God\'s Glory, Law, and Kingship)': 'Psalms celebrating God\'s revelation through creation and scripture while anticipating the entrance of the King of Glory.',
      '19 (The Heavens Declare)': 'Creation and scripture reveal God\'s glory and perfect law, prompting a prayer for personal purity.',
      '20 (The King\'s Victory)': 'The community prays for the king\'s success in battle and subsequently rejoices in the divine strength that granted him triumph.',
      '22 (The Suffering Servant)': 'A desperate cry of abandonment transitions into a universal proclamation of God\'s sovereign rule.',
      '1–21 (The Cry of Anguish and Forsakenness)': 'The psalmist cries out in anguish, feeling utterly forsaken by God and surrounded by mocking enemies who inflict intense physical suffering.',
      'Psalm 22:6': 'But I am a worm and not a man, scorned by everyone, despised by the people.',
      'Psalm 22:8': '"He trusts in the Lord," they say, "let the Lord rescue him. Let him deliver him, since he delights in him."',
      'Psalm 22:14': 'I am poured out like water, and all my bones are out of joint; my heart has turned to wax; it has melted within me.',
      'Psalm 22:16': 'For dogs have compassed me: the assembly of the wicked have enclosed me: they pierced my hands and my feet.',
      'Psalm 22:18': 'They divide my clothes among them and cast lots for my garment.',
      '22–31 (The Vow of Praise and Victory)': 'Transitioning from suffering to triumph, the psalmist vows to praise God within the congregation and prophesies universal worship.',
      '22–24 (Praise in the Congregation)': 'A shift from lament to thanksgiving, promising to declare God\'s name to the brethren because He did not hide His face.',
      '25–29 (Universal Worship)': 'The vision expands to include all ends of the earth and all families of nations worshiping the Lord.',
      '30–31 (Future Generations)': 'A concluding promise that posterity will serve God and declare His righteousness to a people yet unborn.',
      '23 (The Good Shepherd)': 'The psalmist expresses total trust in God\'s provision, guidance, and protection through the metaphor of a caring shepherd.',
      'Psalm 23:4': 'Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.',
      '24 (The King of Glory)': 'A liturgical entrance hymn identifying the requirements for worshiping God and celebrating His arrival as the mighty King of Glory.',
      '25–37 (Instruction, Trust, and Integrity)': 'A shift toward internal wisdom and seeking God\'s guidance, emphasizing personal integrity and waiting on the Lord.',
      '38–41 (Penitence, Sickness, and Betrayal)': 'The first book concludes with confession for sin and pleas for mercy during physical illness and betrayal by close friends.',
      '42–72 (Book II: Exodus Comparison)': 'Psalms emphasizing national deliverance and redemption, ending with the note that the prayers of David are concluded.',
      '42–43 (Longing for God in Exile)': 'A Levite singer expresses deep spiritual thirst for God\'s presence while facing mockery and physical distance from the Jerusalem sanctuary.',
      '44 (A National Lament)': 'The community questions why God has seemingly abandoned them to defeat despite their continued faithfulness to the covenant.',
      '45 (A Royal Wedding Song)': 'A unique psalm celebrating the marriage of a Davidic king to a foreign princess, emphasizing the king\'s splendor and the bride\'s beauty.',
      '46–48 (Zion, the City of God)': 'Psalms exalting God as a refuge and strength, celebrating His sovereign protection over Jerusalem against the raging nations.',
      '49 (The Futility of Wealth)': 'A wisdom psalm warning that riches cannot ransom a soul from death and that worldly honor is fleeting compared to God\'s redemption.',
      '50 (God\'s Judgment of Israel)': 'The Lord appears in fire and tempest to rebuke His people for hollow ritualism and demand heartfelt thanksgiving and obedience.',
      '51 (David\'s Prayer of Repentance)': 'Following his sin with Bathsheba, David pleads for mercy and a clean heart, recognizing God desires a broken spirit over animal sacrifice.',
      '52–55 (Betrayal and Deceit)': 'Prayers focused on the treachery of enemies and close friends, with the psalmist casting his burdens on the Lord.',
      '56–60 (Prayers for Protection from Enemies)': 'Written during various crises in David\'s life, these psalms feature cries for deliverance from those who lie in wait to destroy him.',
      '61–63 (Thirsting for God)': 'The psalmist finds security and soul-satisfaction in God\'s presence, even when praying from a dry and weary land.',
      '64–68 (God\'s Power in Nature and History)': 'Hymns praising God\'s provision in the harvest and His triumphant march as a warrior leading His people from Egypt to Zion.',
      '64 (Protection from Secret Plots)': 'David petitions God to shield him from verbal attacks of the wicked, trusting that God will unexpectedly strike them with His own arrows.',
      '65 (God\'s Bounty in Creation)': 'This hymn celebrates God as the silencer of the seas and provider of the harvest who crowns the year with His goodness.',
      '66 (A Liturgy of Thanksgiving)': 'The community witnesses God\'s awesome deeds in history and nature, followed by an individual\'s personal testimony of answered prayer.',
      '66:1–4 (Universal Praise for God\'s Works)': 'The psalmist calls for all the earth to shout with joy and sing the glory of God\'s name because of His awesome and powerful deeds.',
      '66:5–7 (The Great Deliverance at the Sea)': 'The community is invited to see how God turned the sea into dry land, allowing His people to pass through on foot.',
      '66:8–12 (Refining Through Suffering)': 'God is praised for preserving the lives of His people despite testing them through fire and water to bring them into abundance.',
      '66:13–15 (Vows of Sacrifice)': 'The speaker prepares to enter the temple with burnt offerings to fulfill the promises made during a time of deep distress.',
      '66:16–20 (A Personal Testimony of Answered Prayer)': 'The psalm concludes with an invitation for the godly to hear how the Lord responded because no iniquity was cherished in the psalmist\'s heart.',
      '67 (A Prayer for Global Blessing)': 'The psalmist asks for God\'s grace upon Israel so that His ways and saving power may be known among all nations of the earth.',
      '68 (The Triumphant Procession of God)': 'A complex victory song depicting God as a majestic warrior who scatters His enemies and leads a grand procession to His sanctuary on Mount Zion.',
      '69–71 (Cries of the Suffering and Elderly)': 'An individual facing overwhelming waters and the challenges of old age petitions God for continued strength and the shame of his accusers.',
      '72 (A Prayer for the Messianic King)': 'The second book concludes with a vision of a righteous king whose universal reign brings justice to the poor and peace to the earth.',
      '73–89 (Book III: Leviticus Comparison)': 'Centered on the sanctuary and community, this book of largely Asaphic psalms reflects on the corporate struggles of the people.',
      '73 (The Prosperity of the Wicked)': 'Asaph struggles with the apparent injustice of the wicked thriving while the righteous suffer, but finds clarity after entering the sanctuary.',
      '74 (A Prayer for the Defiled Sanctuary)': 'The community laments the destruction of the temple and appeals to God\'s past deeds as Creator to intervene and remember His covenant.',
      '75–76 (God as the Righteous Judge)': 'These psalms celebrate God\'s sovereignty in bringing low the arrogant and establishing peace in Zion through His formidable power.',
      '77 (Comfort in God\'s Past Power)': 'A distressed individual finds hope by intentionally remembering how God led His people through the Red Sea during the Exodus.',
      '78 (Lessons from Israel\'s History)': 'A long didactic poem recounting the nation\'s history of rebellion and mercy, culminating in the selection of Zion and the Davidic monarchy.',
      '79–80 (Lament for the Fallen Nation)': 'The people cry out for restoration after the destruction of Jerusalem, pleading for the Shepherd of Israel to cause His face to shine.',
      '81–83 (Exhortation and Judgment)': 'God warns His people to listen, condemns corrupt judges, and is petitioned to scatter the surrounding nations plotting to destroy Israel.',
      '84–85 (Longing for God\'s Dwelling)': 'The psalmists express deep yearning for the courts of the Lord and celebrate restoration of the land where righteousness and peace have kissed.',
      '86–88 (Prayers in Deep Distress)': 'A humble plea for mercy, a celebration of Zion as birthplace of nations, and a harrowing lament from a sufferer who feels trapped in the pit.',
      '86 (A Prayer in the Day of Trouble)': 'David appeals to God\'s mercy and unique power as the only true God, requesting an undivided heart to walk in truth despite violent enemies.',
      '86:1–7 (A Plea for Help)': 'The psalmist cries out for mercy and preservation based on his devotion and God\'s readiness to forgive those who call upon Him.',
      '86:8–10 (The Incomparable God)': 'David acknowledges that no other gods or works compare to the Lord, who is great and performs wonders as the only true God.',
      '86:11–13 (A Prayer for Guidance)': 'The singer asks for divine instruction and an undivided heart to fear God\'s name, thanking Him for deliverance from the depths of Sheol.',
      '86:14–15 (God\'s Compassionate Character)': 'Amidst threats of arrogant men, the psalmist appeals to God\'s nature as full of compassion, grace, and abounding in steadfast love.',
      '86:16–17 (A Request for a Sign)': 'David petitions for strength and a visible token of God\'s favor to put his enemies to shame and confirm that the Lord is his helper.',
      '87 (The City of God)': 'Zion is celebrated as the foundation of God\'s love and the spiritual birthplace of all nations, where even former enemies are recorded as citizens.',
      '88 (The Darkest Lament)': 'A lifelong sufferer describes feeling abandoned by God and friends alike, concluding without the typical resolution of praise.',
      '89 (The Crumbled Covenant)': 'The book concludes by praising God\'s eternal covenant with David but transitions into a mournful cry because the Davidic throne has been cast to the ground.',
      '90–106 (Book IV: Numbers Comparison)': 'Opening with a prayer of Moses, this section highlights God\'s sovereignty over the nations and His faithfulness throughout Israel\'s wilderness history.',
      '107–150 (Book V: Deuteronomy Comparison)': 'The final book focuses on God\'s Word and the celebration of His kingdom, culminating in five Hallelujah psalms as a grand finale.',
      // Proverbs
      'Proverbs': 'A collection of practical wisdom for righteous living, emphasizing the fear of the Lord and moral discernment as foundations for life.',
      '1–9 (The Prologue: Exhortations to Wisdom)': 'Ten lengthy discourses from father to son, personifying Wisdom and Folly as competing women and urging the reader to choose the fear of the Lord.',
      '1:1–7 (Purpose and Theme)': 'The collection begins by defining its goal to provide skill for living, introducing the book\'s motto: the fear of the Lord is the beginning of knowledge.',
      '1:8–19 (Warning Against Enticing Sinners)': 'A father appeals to his son to reject the easy money offered by violent men, warning that those who set traps for others ultimately ambush their own lives.',
      '1:20–33 (The Call of Wisdom)': 'Personified Wisdom stands in the public square, rebuking the simple and scoffers while promising security to listeners and calamity to those who refuse.',
      '2 (The Benefits of Wisdom)': 'Diligent searching for wisdom is compared to a treasure hunt that leads to understanding the fear of God and provides a shield against evil.',
      '3:1–12 (Trusting the Lord)': 'A famous exhortation to trust in the Lord with all one\'s heart rather than relying on human understanding, including honoring God with the firstfruits.',
      '3:13–35 (The Value and Peace of Wisdom)': 'Wisdom is described as more profitable than silver or gold, acting as a tree of life that brings peace, security, and favor with both God and man.',
      '4 (The Father\'s Instruction)': 'The father recounts the wisdom received from his own father, urging his son to guard his heart above all else as the wellspring of life.',
      '5 (Warning Against Adultery)': 'Vivid imagery contrasts the bitter end of infidelity with the joy and intimacy found in a lifelong marriage.',
      '6:1–19 (Practical Warnings and the Seven Abominations)': 'Advice against financial folly and laziness—pointing to the ant as a model—concludes with a list of seven things the Lord hates.',
      '6:20–35 (The High Cost of Adultery)': 'The father explains that while a thief steals to satisfy hunger, an adulterer destroys his own soul and incurs unquenchable jealousy.',
      '7 (The Crafty Seductress)': 'A dramatic narrative describes a young man without sense being lured to ruin by a seductive woman, illustrating how her path leads to death.',
      '8 (Wisdom\'s Autobiography)': 'Wisdom speaks, claiming her ancient origin beside God during creation and inviting all humanity to find life through her.',
      '1–11 (Wisdom\'s Public Call)': 'Wisdom stands in prominent public places to invite all people—especially the simple and the foolish—to choose her instruction over material wealth.',
      '12–21 (The Character and Authority of Wisdom)': 'Wisdom describes how she grants kings and rulers the ability to govern justly and provides enduring wealth to those who love her.',
      'Proverbs 8:12': 'I, wisdom, dwell with prudence, and I find knowledge and discretion.',
      '22–31 (Wisdom\'s Role in Creation)': 'Wisdom is depicted as present with God before the world began and acting as a master workman during creation.',
      'Proverbs 8:22': 'The Lord possessed me at the beginning of His way, before His works of old.',
      'Proverbs 8:23': 'From everlasting I was established, from the beginning, from the earliest times of the earth.',
      'Proverbs 8:30': 'Then I was beside Him, as a master workman; and I was daily His delight, rejoicing always before Him.',
      '32–36 (The Final Invitation and Warning)': 'A final appeal for the reader to watch daily at Wisdom\'s gates, equating finding her with finding life and the Lord\'s favor.',
      '9 (The Two Banquets)': 'The prologue concludes by contrasting the invitations of Lady Wisdom and Lady Folly: both prepare a feast, but one leads to life and the other to death.',
      '10:1–22:16 (The Proverbs of Solomon)': 'Short, pithy couplets contrasting the wise and the foolish across themes like speech, wealth, diligence, and justice.',
      '22:17–24:22 (The Thirty Sayings of the Wise)': 'Advice modeled after ancient Near Eastern wisdom literature, focusing on practical social conduct and respect for the poor.',
      '24:23–34 (Further Sayings of the Wise)': 'A brief appendix warning against partiality in judgment and the dangers of laziness.',
      '25–29 (Hezekiah\'s Collection of Solomon\'s Proverbs)': 'Chapters transcribed by King Hezekiah\'s men, including many metaphors regarding leadership and social harmony.',
      '25 (Proverbs of Relationships and Self-Control)': 'This section focuses on proper conduct before kings and the importance of self-restraint, comparing a man without it to a city with broken-down walls.',
      '26:1–12 (The Anatomy of a Fool)': 'A concentrated series of metaphors describing the behavior of fools, noting that a fool returning to his folly is like a dog returning to its vomit.',
      '26:13–28 (The Sluggard and the Deceiver)': 'These verses contrast the laziness of the sluggard with the destructive nature of gossips and liars who kindle strife like wood feeds a fire.',
      '27 (The Nature of Friendship and Foresight)': 'This section highlights the value of honest counsel, stating that iron sharpens iron and that the wounds of a friend are more faithful than an enemy\'s kisses.',
      '28 (Integrity versus Wickedness)': 'A series of contrasts exploring how the righteous are bold as a lion while the wicked flee, emphasizing that concealing sin leads to ruin.',
      '29 (Leadership and Social Order)': 'The final chapter addresses the impact of a ruler\'s character on a nation, observing that when the righteous thrive, the people rejoice.',
      'Proverbs 29:18': 'Where there is no revelation, the people cast off restraint; but blessed is he who keeps the law.',
      '30 (The Sayings of Agur)': 'A unique section characterized by numerical proverbs and a humble admission of human limitation before God.',
      '30:1–9 (The Wisdom of Agur)': 'Agur begins with a humble confession of his own ignorance before God\'s transcendence, concluding with a prayer to be granted neither poverty nor riches.',
      'Proverbs 30:4': 'Who has ascended into heaven, or descended? Who has gathered the wind in His fists? Who has bound the waters in a garment? Who has established all the ends of the earth? What is His name, and what is His Son\'s name, if you know?',
      'Proverbs 30:5': 'Every word of God is flawless; he is a shield to those who take refuge in him.',
      '30:11–14 (A Generation of Evil)': 'A corrupt generation is described with four specific sins: cursing parents, self-righteousness, prideful eyes, and exploitation of the poor.',
      '30:15–16 (Four Things Never Satisfied)': 'Using the imagery of a leech, Agur lists four things that never say "Enough": the grave, the barren womb, parched land, and a consuming fire.',
      '30:17 (Judgment on the Rebellious)': 'A vivid single-verse warning describes the gruesome fate of those who mock their father or scorn their mother.',
      '30:18–20 (Four Things Too Amazing to Understand)': 'The author reflects on four mysterious ways—the eagle, the serpent, the ship, and a man with a virgin—contrasted with the callous way of an adulteress.',
      '30:21–23 (Four Things That Make the Earth Tremble)': 'Four social inversions considered unbearable: a servant becoming king, a fool gorged with food, an unloved woman married, and a maid replacing her mistress.',
      '30:24–28 (Four Things Small but Wise)': 'Four creatures praised for their instinctive wisdom despite lacking strength: the ant, rock badger, locust, and lizard.',
      '30:29–33 (Four Things Stately in Stride)': 'Four things that move with impressive confidence—the lion, the strutting rooster, the male goat, and a king—followed by a warning against prideful strife.',
      '31:1–9 (The Sayings of King Lemuel)': 'Advice given by a mother to her king-son, warning against the pitfalls of wine and women while advocating for the rights of the oppressed.',
      '31:10–31 (The Virtuous Woman)': 'An acrostic poem praising the woman of valor who manages her household with wisdom, industry, and the fear of the Lord.',
      // Ecclesiastes
      'Ecclesiastes': 'A philosophical search for meaning in a seemingly meaningless world, emphasizing the vanity of earthly pursuits and the importance of fearing God.',
      '1:1–11 (The Futility of All Endeavors)': 'The Teacher introduces the central theme of vanity, observing that human toil and the natural cycles of the world appear repetitive and ultimately meaningless.',
      '1:12–2:26 (The Pursuit of Wisdom and Pleasure)': 'After testing intellectual pursuits, luxury, and physical indulgence, the author concludes that even these are like chasing the wind.',
      '3 (A Time for Everything)': 'A poetic reflection asserting that God has appointed a specific season for every human activity and has placed eternity in the human heart.',
      'A Time for Everything (3:1–8)': 'A famous poetic catalog of fourteen pairs of opposites illustrating that every human activity has an appointed season.',
      'Ecclesiastes 3:8': 'A time to love, and a time to hate; a time for war, and a time for peace.',
      'The God-Given Task (3:9–15)': 'A theological reflection stating that while God has set eternity in the human heart, people cannot fully fathom the divine plan.',
      'The Fate of Humans and Beasts (3:16–22)': 'A skeptical inquiry into the lack of justice in the world and the shared physical end of all living creatures.',
      '4:1–6:12 (The Observations of Social Injustice and Wealth)': 'The Teacher examines the vanities of oppression, isolation, and the fleeting nature of riches that fail to satisfy the soul.',
      '7:1–10:20 (Wisdom for Living in a Vain World)': 'Practical, often cynical, proverbs on navigating a world where the righteous often suffer and the wicked prosper.',
      '11:1–12:8 (Advice to the Young and the Certainty of Death)': 'Young people are encouraged to enjoy their lives while remembering their Creator before the physical decline of old age.',
      '12:9–14 (The Conclusion of the Matter)': 'The book ends with an editorial epilogue: the whole duty of man is to fear God and keep His commandments in light of the coming judgment.',
      // Song of Solomon
      'Song of Solomon': 'A collection of love poems between a man and a woman expressing passionate desire and devotion.',
      '1:1–2:7 (The Beginning of Love)': 'The Shulammite woman and her beloved exchange intense expressions of mutual desire and admiration, setting the stage for their deepening affection.',
      '2:8–3:5 (A Springtime Visit and a Dream)': 'The couple enjoys the beauty of nature together, followed by a nocturnal search where the woman expresses the urgency of finding her lover.',
      '3:6–5:1 (The Royal Wedding)': 'King Solomon arrives in a magnificent procession for the wedding, which culminates in the poetic celebration of their marital union.',
      '5:2–6:3 (A Conflict and Search)': 'A dream-like struggle and temporary separation lead to a renewed declaration of their belonging to one another.',
      '6:4–8:4 (Admiration and Longing)': 'The lover praises the woman\'s beauty with vivid imagery, and the couple expresses a desire to retreat into the countryside.',
      '8:5–14 (The Power of Love)': 'The book concludes by describing love as a force as strong as death that cannot be quenched, ending with a final call for the beloved to hasten.',
      'New Testament': 'The Christian scriptures narrating Jesus\'s life and early Christian history and theology.',
      'Gospels': 'The four accounts of Jesus\'s life, teachings, death, and resurrection in the New Testament.',
      'Epistles': 'Letters written by early Christian leaders addressing theological and practical matters.',
      'Revelation': 'The apocalyptic final book of the New Testament prophesying the end times and God\'s ultimate triumph.',
      'Acts': 'The New Testament narrative of the early church\'s growth, apostolic authority, and missionary expansion.',
      'Pauline Theology': 'The theological teachings of Paul regarding grace, faith, salvation, and Christian living.',
      'Biblical Theology': 'The systematic study of theological themes within biblical texts.',
      'Biblical Archaeology': 'The archaeological investigation of ancient biblical sites and their cultural context.',
      'Biblical Languages': 'The study of Hebrew, Aramaic, and Koine Greek in which biblical texts were composed.',
      'Comparative Religion': 'The systematic study of similarities and differences in beliefs, practices, and structures across religions.',
      'Religious Philosophy': 'The philosophical examination of god, faith, religious knowledge, and the problem of evil.',
      'Mythology': 'The collection and interpretation of myths from various cultures explaining origins and cosmic order.',
      'Greek Mythology': 'The myths and legends of ancient Greece featuring gods, heroes, and cosmic narratives.',
      'Roman Mythology': 'The myths and pantheon of ancient Rome, often adapted from Greek sources.',
      'Norse Mythology': 'The myths of ancient Scandinavia featuring gods, giants, and the apocalyptic Ragnarok.',
      'Egyptian Mythology': 'The myths and religious beliefs of ancient Egypt regarding the gods and afterlife.',
      // Arts Reorganization
      'Arts': 'The collective expression of human creativity through visual, performing, and literary means.',
      // Visual Arts
      'Visual Arts': 'The branches of art emphasizing visual representation including painting, sculpture, and design.',
      'Color Theory': 'The science and art of color relationships, harmony, and emotional expression in visual composition.',
      'Technique': 'The practical skills, methods, and technical processes used in creating visual artworks.',
      'Contemporary Sculpture': 'Current sculptural practices exploring new materials, conceptual approaches, and public engagement.',
      'Architectural Theory': 'The philosophy and critical analysis of architectural principles, movements, and design methodology.',
      'Urban Design': 'The planning and design of cities, public spaces, and urban environments for livability and aesthetics.',
      'Black and White Photography': 'Photography using monochromatic tones emphasizing form, contrast, and emotional intensity.',
      'Color Photography': 'The art of photography using color to convey mood, meaning, and aesthetic beauty.',
      'Documentary Photography': 'Photography that records real events and conditions, often advocating for social issues.',
      'Fine Art Photography': 'Photography created primarily for aesthetic and conceptual merit rather than commercial use.',
      'Photojournalism': 'The practice of telling news stories through photographs, presenting factual visual documentation.',
      'Film': 'The art and industry of moving images and sound, a powerful medium for narrative and expression.',
      'Film History': 'The chronological development of cinema from its invention through contemporary filmmaking.',
      'Film Theory': 'The critical and philosophical analysis of film aesthetics, narrative, and cultural significance.',
      'Cinematography': 'The technical art of capturing images through lighting, composition, and camera techniques.',
      'Film Genres': 'The categories and conventions of film including drama, comedy, horror, science fiction, and romance.',
      'Film Criticism': 'The analysis and evaluation of films as artworks and cultural artifacts.',
      'Animation': 'The art of creating the illusion of movement through sequential image display.',
      'Documentary Film': 'Films presenting factual information and reality rather than fictional narratives.',
      'Digital Painting': 'Painting created using digital software and electronic tools on tablets or computers.',
      'Digital Sculpture': 'Three-dimensional artwork created, modified, or displayed using digital technology.',
      'Virtual Reality Art': 'Immersive art experiences using head-mounted displays creating artificial environments.',
      'Generative Art': 'Art created using algorithms, code, or autonomous systems to produce unpredictable outcomes.',
      'Interactive Art': 'Sculptures and installations encouraging audience participation and engagement with the artwork.',
      'Typography': 'The art and technique of arranging type to make written language visually appealing and readable.',
      'Logo Design': 'The creation of distinctive visual brands and symbolic marks representing companies or organizations.',
      'Web Design': 'The artistic and technical design of websites for aesthetics, functionality, and user experience.',
      'Branding': 'The strategic design and communication of a company\'s identity, values, and market position.',
      'Layout Design': 'The arrangement of visual and textual elements in space to create organized, attractive compositions.',
      'Printmaking': 'The artistic technique of creating images through inking, pressing, and transferring onto paper or fabric.',
      // Performing Arts
      'Performing Arts': 'The branches of art involving live performance including theatre, dance, and performance art.',
      'Theatre': 'The dramatic art of storytelling and character portrayal through live performance on stage.',
      'Classical Theatre': 'Theatre from ancient Greece and Rome, including works by Aeschylus, Sophocles, Euripides, and Plautus.',
      'Modern Theatre': 'Theatre from the late 19th and 20th centuries exploring realism and psychological depth.',
      'Contemporary Theatre': 'Current theatrical practices with diverse aesthetics and engagement with social issues.',
      'Theatre Theory': 'The critical and philosophical analysis of dramatic structure, performance, and theatrical meaning.',
      'Directing': 'The creative leadership of actors and artistic teams in realizing a dramatic vision.',
      'Acting': 'The craft of portraying characters, using voice, body, and emotion to convey authentic human experience.',
      'Stage Design': 'The visual design of theatrical environments including scenery, lighting, and spatial arrangement.',
      'Dance': 'The art form using structured movement, rhythm, and expression of the human body.',
      'Classical Dance': 'Formal dance traditions with codified techniques and long historical development.',
      'Modern Dance': 'Dance emphasizing personal expression and freedom from classical ballet traditions.',
      'Contemporary Dance': 'Current dance exploring diverse styles, fusion, and experimental movement vocabulary.',
      'Ballet': 'The classical dance form emphasizing technique, grace, storytelling, and ethereal movement quality.',
      'Jazz Dance': 'Dance style incorporating jazz music rhythms, improvisation, and energetic hip iso lations.',
      'Hip Hop Dance': 'Street dance culture incorporating breaking, locking, popping, and freestyle movement.',
      'Musical Theatre': 'Theatre combining drama, music, dance, and spectacle to tell stories through song.',
      // Design
      'Design': 'The process of planning and creating solutions for human needs through form and function.',
      'Industrial Design': 'The design of manufactured goods balancing aesthetics, function, and commercial viability.',
      'Fashion Design': 'The creation of clothing and accessories expressing personal style and cultural values.',
      'Interaction Design': 'The design of digital interfaces making technology intuitive and usable for humans.',
      'Game Design': 'The creation of rules, mechanics, and narrative experiences in video games and tabletop games.',
      // Additional Language topics
      'Austronesian Languages': 'Language family including Indonesian, Tagalog, and languages of the Pacific islands.',
      'Altaic Languages': 'Disputed language grouping potentially including Turkish, Mongolian, and Tungusic languages.',
      'Phonetics': 'The study of sounds in human speech and how they are produced and perceived.',
      'Semantics': 'The study of meaning in language, including how words and sentences convey significance.',
      // Additional Music topics
      'Music Theory': 'The study of musical structure, harmony, melody, rhythm, and the principles of composition.',
      'Composition': 'The creation of original musical works using melody, harmony, and orchestration.',
      'Orchestral Music': 'Music composed for large ensembles of orchestral instruments with diverse timbral possibilities.',
      'Chamber Music': 'Music composed for small ensembles, typically one instrument per part, emphasizing intimacy.',
      'Modal Jazz': 'Jazz style based on scales or modes rather than traditional chord changes.',
      'Jazz Standards': 'Widely recognized jazz tunes from earlier eras that form the repertoire of jazz musicians.',
      'Classic Rock': 'Rock music from the 1960s-1980s emphasizing guitar-driven songs and album-oriented rock.',
      'Progressive Rock': 'Rock music using complex structures, diverse instruments, and musical sophistication.',
      'Punk Rock': 'Rock movement emphasizing fast tempos, simple chords, and DIY attitude and ethics.',
      'Alternative Rock': 'Rock music from the 1980s-1990s rejecting mainstream conventions.',
      'Heavy Metal': 'Rock music with distorted guitars, powerful vocals, and dark, intense themes.',
      // Literature expansions
      'Essays': 'Short non-fiction prose compositions exploring ideas from a personal or argumentative perspective.',
      'Narrative Forms': 'The structures and techniques of storytelling across various literary genres and media.',
      'Epic Poetry': 'Long narrative poems narrating heroic deeds and cultural mythology.',
      'Lyric Poetry': 'Poetry emphasizing personal emotion, imagery, and musical qualities of language.',
      'Contemporary Drama': 'Current theatrical works engaging with contemporary social, political, and personal issues.',
      'Melodrama': 'Dramatic works emphasizing emotional extremes, clear moral distinctions, and spectacular effects.',
      // Additional Literary Theory concepts
      'Literary Criticism': 'The analysis and interpretation of literature examining meaning, themes, and artistic achievement.',
    }
    // If a summary exists, use it
    if (summaries[label]) return summaries[label];
    // No custom summary available - return empty string instead of placeholder
    return '';
  }

  // Knowledge base mapping topics to their meaningful subdivisions
  const hasKnownSubdivisions = (label) => {
    return TOPIC_SUBDIVISIONS.hasOwnProperty(label) && TOPIC_SUBDIVISIONS[label].length > 0
  }

  const fetchWikipediaSuggestions = async (query) => {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=categories&cllimit=50&format=json&origin=*`
      )
      const data = await response.json()
      const pages = data.query?.pages || {}
      const categories = []
      
      for (const page of Object.values(pages)) {
        if (page.categories) {
          categories.push(...page.categories.map((c) => c.title.replace('Category:', '')))
        }
      }
      
      // Return categories that look like subcategories (contain the query term or are plausible topics)
      // Use word boundary matching to avoid matching substrings inside words
      return categories
        .filter((cat) => {
          if (cat.length <= 5) return false
          const regex = new RegExp(`\\b${query.toLowerCase()}`, 'i')
          return regex.test(cat) || cat.toLowerCase().startsWith(query.toLowerCase())
        })
    } catch (error) {
      console.error('Failed to fetch Wikipedia suggestions:', error)
      return []
    }
  }

  const getChildSuggestions = async (parentLabel) => {
    // First check if we have curated subdivisions for this topic
    if (TOPIC_SUBDIVISIONS[parentLabel]) {
      return TOPIC_SUBDIVISIONS[parentLabel]
    }
    
    // Fallback to generic labels (will be replaced with curated content over time)
    return ['Concept A', 'Concept B']
  }

  useEffect(() => {
    if (!transitionsEnabled && canvasSize.width > 0 && canvasSize.height > 0 && viewportSize.width > 0) {
      const id = requestAnimationFrame(() => setTransitionsEnabled(true))
      return () => cancelAnimationFrame(id)
    }
    return undefined
  }, [canvasSize.width, canvasSize.height, viewportSize.width, transitionsEnabled])

  const addCustomChild = (parentNodeId) => {
    if (!isAuthenticated) {
      setSignInRequired('Sign in to add custom nodes to your private map.')
      return
    }

    const maxExistingId = nodes.reduce((maxId, node) => {
      if (!node || !Number.isFinite(node.id)) return maxId
      return Math.max(maxId, node.id)
    }, 0)
    const newId = Math.max(nextId.current, maxExistingId + 1)

    const newNode = {
      id: newId,
      label: 'New Node',
      parentId: parentNodeId,
      isCustom: true,
      hidden: false,
      summary: '',
    }

    nextId.current = newId + 1

    if (enableAnimations) {
      setAnimatingIds(new Set([newId]))
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== parentNodeId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
      requestAnimationFrame(() => setAnimatingIds(new Set()))
    } else {
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== parentNodeId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
    }

    // Focus the new node and enter edit mode
    setFocusedElement({ nodeId: newId, type: 'node' })
    setEditingNodeId(newId)
    // Focus the input after a short delay to ensure rendering
    setTimeout(() => editInputRef.current?.focus(), 100)
  }

  const addCustomSibling = (referenceNodeId) => {
    if (!isAuthenticated) {
      setSignInRequired('Sign in to add custom nodes to your private map.')
      return
    }

    const referenceNode = nodes.find((node) => node.id === referenceNodeId)
    if (!referenceNode || referenceNode.parentId === null) {
      alert('Cannot add a sibling to the root node.')
      return
    }

    const maxExistingId = nodes.reduce((maxId, node) => {
      if (!node || !Number.isFinite(node.id)) return maxId
      return Math.max(maxId, node.id)
    }, 0)
    const newId = Math.max(nextId.current, maxExistingId + 1)

    const newNode = {
      id: newId,
      label: 'New Node',
      parentId: referenceNode.parentId,
      isCustom: true,
      hidden: false,
      summary: '',
    }

    nextId.current = newId + 1

    if (enableAnimations) {
      setAnimatingIds(new Set([newId]))
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== referenceNode.parentId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
      requestAnimationFrame(() => setAnimatingIds(new Set()))
    } else {
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== referenceNode.parentId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
    }

    // Focus the new node and enter edit mode
    setFocusedElement({ nodeId: newId, type: 'node' })
    setEditingNodeId(newId)
  }

  const deleteCustomNode = (nodeId) => {
    if (!isAuthenticated) {
      setSignInRequired('Sign in to delete custom nodes.')
      return
    }

    const nodeToDelete = nodes.find((node) => node.id === nodeId)
    if (!nodeToDelete) return

    if (!nodeToDelete.isCustom) {
      alert('Only custom nodes can be deleted.')
      return
    }

    const hasChildren = nodes.some((node) => node.parentId === nodeId)
    const confirmMessage = hasChildren 
      ? `Delete "${nodeToDelete.label}" and all its children?`
      : `Delete "${nodeToDelete.label}"?`

    // Show modern confirmation modal instead of window.confirm
    setDeleteModalChoice('cancel')
    setDeleteConfirmation({ nodeId, message: confirmMessage, includeChildren: hasChildren })
  }

  const confirmDelete = () => {
    if (!deleteConfirmation) return
    const nodeId = deleteConfirmation.nodeId

    // Remove the node and all its descendants
    const nodeIdsToRemove = new Set([nodeId])
    const findDescendants = (parentId) => {
      nodes.forEach((node) => {
        if (node.parentId === parentId) {
          nodeIdsToRemove.add(node.id)
          findDescendants(node.id)
        }
      })
    }
    findDescendants(nodeId)

    setNodes((prev) => prev.filter((node) => !nodeIdsToRemove.has(node.id)))
    
    // Clear selection and focus if the deleted node was selected/focused
    if (selectedId === nodeId) {
      setSelectedId(null)
      setPanelOpen(false)
    }
    if (focusedElement?.nodeId === nodeId) {
      setFocusedElement(null)
    }

    setDeleteModalChoice('cancel')
    setDeleteConfirmation(null)
  }

  const cancelDelete = () => {
    setDeleteModalChoice('cancel')
    setDeleteConfirmation(null)
  }

  const updateNodeLabel = (nodeId, newLabel) => {
    if (!newLabel.trim()) {
      // If empty, revert to default or delete the node
      const node = nodes.find(n => n.id === nodeId)
      if (node && node.isCustom) {
        // Show modern modal instead of window.confirm
        setDeleteModalChoice('cancel')
        setDeleteConfirmation({ nodeId, message: 'Delete this empty node?', includeChildren: false })
      }
      setEditingNodeId(null)
      return
    }

    // Check if this is a custom node BEFORE updating state
    const node = nodes.find(n => n.id === nodeId)
    const isCustom = node?.isCustom
    const parentId = node?.parentId

    setNodes((prev) => {
      // Update the label
      const updated = prev.map((n) =>
        n.id === nodeId ? { ...n, label: newLabel.trim() } : n
      )

      // If it's a custom node, reorder it alphabetically among siblings
      if (isCustom && parentId !== undefined) {
        // Find the current node in updated array
        const nodeIdx = updated.findIndex(n => n.id === nodeId)
        if (nodeIdx !== -1) {
          const nodeToMove = updated[nodeIdx]
          const withoutNode = [...updated.slice(0, nodeIdx), ...updated.slice(nodeIdx + 1)]
          
          // Find correct position alphabetically
          const insertIdx = withoutNode.findIndex(n => {
            if (n.parentId !== parentId) return false
            return nodeToMove.label.localeCompare(n.label) < 0
          })
          
          // Insert at correct position
          const finalIdx = insertIdx === -1 ? withoutNode.length : insertIdx
          return [...withoutNode.slice(0, finalIdx), nodeToMove, ...withoutNode.slice(finalIdx)]
        }
      }
      
      return updated
    })
    
    setEditingNodeId(null)

    // Auto-select and open sidebar for custom nodes after editing
    if (isCustom) {
      setSelectedId(nodeId)
      setPanelOpen(true)
      setPanelExpanded(false)
    }
  }

  const addChildren = async (parentNodeId) => {
    const parent = nodes.find((node) => node.id === parentNodeId)
    if (!parent) return { expanded: false }

    const existingChildren = nodes.filter((node) => node.parentId === parentNodeId && !node.hidden)
    const nonCustomChildren = existingChildren.filter((node) => !node.isCustom)
    const hiddenChildren = nodes.filter((node) => node.parentId === parentNodeId && node.hidden)

    if (existingChildren.length > 0) {
      setNodes((prev) =>
        prev.map((node) =>
          node.parentId === parentNodeId ? { ...node, hidden: true } : node
        )
      )
      setAnimatingIds(new Set())
      setSelectedId(null)
      lastFocusedIdRef.current = parentNodeId
      setBasePanOffset({ x: 0, y: 0 })
      setRecenterKey((k) => k + 1)
      setForceRecenter(true)
      setTimeout(() => setForceRecenter(false), 100)
      return { expanded: false }
    } else {
      let updatedNodes = nodes.map((node) => {
        if (node.parentId === parentNodeId && node.hidden) {
          return { ...node, hidden: false }
        }
        if (node.parentId !== parentNodeId) {
          const ancestors = new Set()
          let current = node
          while (current && current.parentId) {
            ancestors.add(current.parentId)
            current = nodes.find(n => n.id === current.parentId)
          }
          if (ancestors.has(parentNodeId)) {
            return { ...node, hidden: true }
          }
        }
        return node
      })

      const allChildren = updatedNodes.filter((node) => node.parentId === parentNodeId)
      const existingPredefined = allChildren.filter((node) => !node.isCustom)

      let firstChildId = null;

        // Always find the leftmost visible child for centering
        const getLeftmostChildId = (allNodes, parentId, layout) => {
          const visibleChildren = allNodes.filter((node) => node.parentId === parentId && !node.hidden);
          if (visibleChildren.length === 0) return null;
          if (typeof layout?.positions?.get === 'function') {
            let leftmost = visibleChildren[0];
            let minX = Infinity;
            for (const child of visibleChildren) {
              const pos = layout.positions.get(child.id);
              if (pos && pos.x < minX) {
                minX = pos.x;
                leftmost = child;
              }
            }
            return leftmost.id;
          }
          return visibleChildren[0].id;
        };

        if (existingPredefined.length === 0) {
          let labels = ['Concept A', 'Concept B'];
          if (parentNodeId === 1) {
            labels = ['Humanities', 'Sciences'];
          } else {
            labels = await getChildSuggestions(parent.label);
          }

          const maxExistingId = updatedNodes.reduce((maxId, node) => {
            if (!node || !Number.isFinite(node.id)) return maxId;
            return Math.max(maxId, node.id);
          }, 0);
          const startId = Math.max(nextId.current, maxExistingId + 1);

          const newNodeIds = Array.from({ length: labels.length }, (_, i) => startId + i);
          const newNodes = Array.from({ length: labels.length }, (_, index) => ({
            id: startId + index,
            label: labels[index],
            parentId: parentNodeId,
            hidden: false,
            summary: generateSummary(labels[index]),
          }));

          nextId.current = startId + newNodes.length;

          if (enableAnimations) {
            setAnimatingIds(new Set(newNodeIds));
            updatedNodes = [...updatedNodes, ...newNodes];
            setNodes(updatedNodes);
            requestAnimationFrame(() => setAnimatingIds(new Set()));
          } else {
            updatedNodes = [...updatedNodes, ...newNodes];
            setNodes(updatedNodes);
          }
          setSelectedId(null);
          lastFocusedIdRef.current = parentNodeId;
          setBasePanOffset({ x: 0, y: 0 });
          setRecenterKey((k) => k + 1);
          setForceRecenter(true);
          setTimeout(() => setForceRecenter(false), 100);
          firstChildId = getLeftmostChildId(updatedNodes, parentNodeId, layout);
        } else {
          setNodes(updatedNodes);
          setSelectedId(null);
          lastFocusedIdRef.current = parentNodeId;
          setBasePanOffset({ x: 0, y: 0 });
          setRecenterKey((k) => k + 1);
          setForceRecenter(true);
          setTimeout(() => setForceRecenter(false), 100);
          firstChildId = getLeftmostChildId(updatedNodes, parentNodeId, layout);
        }

      return { expanded: true, firstChildId };
    }
  }

  const addNoteToNode = (nodeId, options = {}) => {
    const { afterNoteId = null, level = 0 } = options
    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: '',
      level: Math.max(0, Math.min(5, level)),
      createdAt: new Date().toISOString(),
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (() => {
                const notes = [...(node.notes || [])]
                if (!afterNoteId) return [...notes, newNote]
                const insertIndex = notes.findIndex((note) => note.id === afterNoteId)
                if (insertIndex === -1) return [...notes, newNote]
                return [
                  ...notes.slice(0, insertIndex + 1),
                  newNote,
                  ...notes.slice(insertIndex + 1),
                ]
              })(),
            }
          : node
      )
    )

    draftNoteIdsRef.current.add(newNote.id)

    requestAnimationFrame(() => {
      const input = noteInputRefs.current[newNote.id]
      if (input) {
        input.focus()
        input.setSelectionRange(input.value.length, input.value.length)
      }
    })
  }

  const updateNoteText = (nodeId, noteId, text) => {
    if ((text || '').trim()) {
      draftNoteIdsRef.current.delete(noteId)
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === noteId ? { ...note, text } : note
              ),
            }
          : node
      )
    )
  }

  const updateNoteLevel = (nodeId, noteId, delta) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) => {
                if (note.id !== noteId) return note
                const currentLevel = Number.isFinite(note.level) ? note.level : 0
                return {
                  ...note,
                  level: Math.max(0, Math.min(5, currentLevel + delta)),
                }
              }),
            }
          : node
      )
    )
  }

  const removeNoteFromNode = (nodeId, noteId) => {
    draftNoteIdsRef.current.delete(noteId)
    draftGridIdsRef.current.delete(noteId)
    if (lastCreatedGridId === noteId) {
      setLastCreatedGridId(null)
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? { ...node, notes: (node.notes || []).filter((note) => note.id !== noteId) }
          : node
      )
    )
  }

  const handleNoteKeyDown = (event, nodeId, note) => {
    if (event.key === 'Escape') {
      const isDraft = draftNoteIdsRef.current.has(note.id)
      const isEmpty = !(note.text || '').trim()
      if (isDraft && isEmpty) {
        event.preventDefault()
        event.stopPropagation()
        removeNoteFromNode(nodeId, note.id)
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      const noteLevel = Number.isFinite(note.level) ? note.level : 0
      addNoteToNode(nodeId, { afterNoteId: note.id, level: noteLevel })
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      updateNoteLevel(nodeId, note.id, event.shiftKey ? -1 : 1)
      return
    }

    if (event.key === 'Backspace') {
      const target = event.currentTarget
      const noteLevel = Number.isFinite(note.level) ? note.level : 0
      const atStart = target.selectionStart === 0 && target.selectionEnd === 0
      if (atStart && noteLevel > 0) {
        event.preventDefault()
        event.stopPropagation()
        updateNoteLevel(nodeId, note.id, -1)
      }
    }
  }

  const addGridToNode = (nodeId, options = {}) => {
    const { afterNoteId = null, level = 0, rows = 3, cols = 3 } = options
    const newGrid = {
      id: `grid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'grid',
      rows,
      cols,
      data: Array(rows).fill(null).map(() => Array(cols).fill('')),
      level: Math.max(0, Math.min(5, level)),
      createdAt: new Date().toISOString(),
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (() => {
                const notes = [...(node.notes || [])]
                if (!afterNoteId) return [...notes, newGrid]
                const insertIndex = notes.findIndex((note) => note.id === afterNoteId)
                if (insertIndex === -1) return [...notes, newGrid]
                return [
                  ...notes.slice(0, insertIndex + 1),
                  newGrid,
                  ...notes.slice(insertIndex + 1),
                ]
              })(),
            }
          : node
      )
    )

    draftGridIdsRef.current.add(newGrid.id)
    setLastCreatedGridId(newGrid.id)
  }

  const isGridEmpty = (grid) => {
    if (!grid || !Array.isArray(grid.data)) return true
    return grid.data.every((row) =>
      Array.isArray(row) ? row.every((cell) => !(String(cell || '').trim())) : true
    )
  }

  const updateGridCell = (nodeId, gridId, rowIndex, colIndex, value) => {
    if ((value || '').trim()) {
      draftGridIdsRef.current.delete(gridId)
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid'
                  ? {
                      ...note,
                      data: note.data.map((row, rIdx) =>
                        rIdx === rowIndex
                          ? row.map((cell, cIdx) => (cIdx === colIndex ? value : cell))
                          : row
                      ),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const handleGridKeyDown = (event, nodeId, gridId, grid) => {
    if (event.key === 'Escape') {
      const isDraft = draftGridIdsRef.current.has(gridId)
      if (isDraft && isGridEmpty(grid)) {
        event.preventDefault()
        event.stopPropagation()
        removeNoteFromNode(nodeId, gridId)
      }
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      updateNoteLevel(nodeId, gridId, event.shiftKey ? -1 : 1)
      return
    }

    if (event.key === 'Backspace') {
      const gridLevel = Number.isFinite(grid.level) ? grid.level : 0
      if (gridLevel <= 0) return

      // Match note behavior: only outdent when cursor is at the start.
      // For grids, this applies only to the top-left cell (row 0, col 0).
      const target = event.target
      const isGridInput = target.classList && target.classList.contains('grid-cell-input')

      if (isGridInput) {
        const atStart = target.selectionStart === 0 && target.selectionEnd === 0
        if (!atStart) return

        const currentTd = target.closest('td')
        const currentTr = target.closest('tr')
        const isFirstCol = currentTd && currentTd.previousElementSibling === null
        const isFirstRow = currentTr && currentTr.previousElementSibling === null

        if (isFirstRow && isFirstCol) {
          event.preventDefault()
          event.stopPropagation()
          updateNoteLevel(nodeId, gridId, -1)
        }
        return
      }

      // Allow outdent when the grid container itself has focus.
      event.preventDefault()
      event.stopPropagation()
      updateNoteLevel(nodeId, gridId, -1)
    }
  }

  const addGridRow = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid'
                  ? {
                      ...note,
                      rows: note.rows + 1,
                      data: [...note.data, Array(note.cols).fill('')],
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const removeGridRow = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid' && note.rows > 1
                  ? {
                      ...note,
                      rows: note.rows - 1,
                      data: note.data.slice(0, -1),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const addGridColumn = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid'
                  ? {
                      ...note,
                      cols: note.cols + 1,
                      data: note.data.map((row) => [...row, '']),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const removeGridColumn = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid' && note.cols > 1
                  ? {
                      ...note,
                      cols: note.cols - 1,
                      data: note.data.map((row) => row.slice(0, -1)),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const updateNodeSummary = (nodeId, summary) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? { ...node, summary: summary.trim() }
          : node
      )
    )
  }

  const handleFileUpload = async (nodeId, file) => {
    try {
      setUploadingNodeId(nodeId)
      const uploadedFile = await filesAPI.uploadFile(file, nodeId)
      
      // Add file to nodeFiles state
      setNodeFiles((prev) => ({
        ...prev,
        [nodeId]: [...(prev[nodeId] || []), uploadedFile]
      }))
    } catch (err) {
      console.error('File upload error:', err)
      alert(`Failed to upload file: ${err.message}`)
    } finally {
      setUploadingNodeId(null)
    }
  }

  const handleFileDelete = async (nodeId, fileId) => {
    try {
      await filesAPI.deleteFile(fileId)
      setNodeFiles((prev) => ({
        ...prev,
        [nodeId]: (prev[nodeId] || []).filter((f) => f.id !== fileId)
      }))
    } catch (err) {
      console.error('File delete error:', err)
      alert(`Failed to delete file: ${err.message}`)
    }
  }

  const loadFilesForNode = async (nodeId) => {
    try {
      const files = await filesAPI.getFiles(nodeId)
      setNodeFiles((prev) => ({
        ...prev,
        [nodeId]: files
      }))
    } catch (err) {
      console.error('Failed to load files:', err)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setCanvasSize({ width, height })
      if (!anchorSizeRef.current.width && !anchorSizeRef.current.height) {
        anchorSizeRef.current = { width, height }
      }
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const mapPanel = mapPanelRef.current
    if (!mapPanel) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setViewportSize({ width, height })
    })

    observer.observe(mapPanel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isFullscreenMode) return

    const header = headerRef.current
    if (!header) return

    // Measure immediately so panel offset is correct right after exiting fullscreen.
    setHeaderHeight(header.getBoundingClientRect().height)

    const observer = new ResizeObserver(() => {
      setHeaderHeight(header.getBoundingClientRect().height)
    })

    observer.observe(header)
    return () => observer.disconnect()
  }, [isFullscreenMode])

  // Close tooltips when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.top-right')) {
        setOpenTooltip(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Track window resize for re-centering
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load user and maps from backend if authenticated
  useEffect(() => {
    const loadUserData = async () => {
      // Try to get cached user email first
      const cachedUserEmail = localStorage.getItem('everything_user_email')

      try {
        // Try to verify authentication by loading maps
        // The cookie will be sent automatically with credentials: 'include'
        const mapData = await mapsAPI.getMap()
        if (Array.isArray(mapData.nodes) && mapData.nodes.length > 0) {
          const { nodes: normalizedNodes, changed } = normalizeLoadedNodes(mapData.nodes)
          if (changed) {
            await mapsAPI.saveMap(normalizedNodes)
          }
          const nodesWithHidden = normalizedNodes.map((node) =>
            ('hidden' in node) ? node : { ...node, hidden: false }
          )
          setNodesFromBackend(collapseNodesToRoot(nodesWithHidden))
        }

        // Use cached email or set a temporary user object
        if (cachedUserEmail) {
          setCurrentUser({ email: cachedUserEmail })
        } else {
          setCurrentUser({ authenticated: true })
        }
      } catch (err) {
        // Not authenticated, clear cached email
        localStorage.removeItem('everything_user_email')
        console.log('User session invalid')
      }
    }
    loadUserData()
  }, [])

  useEffect(() => {
    if (!currentUser) return;

    if (skipNextAutoSave.current) {
      skipNextAutoSave.current = false;
      return;
    }

    const saveTimer = setTimeout(async () => {
      try {
        await mapsAPI.saveMap(nodes);
      } catch (err) {
        console.error('Failed to save map:', err);
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [nodes, currentUser]);

  // Load files for selected node
  useEffect(() => {
    if (selectedId && isAuthenticated) {
      loadFilesForNode(selectedId)
    }
  }, [selectedId, isAuthenticated]);

  const bounds = layout.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const baseOffsetX = PADDING - bounds.minX
  const baseOffsetY = PADDING - bounds.minY
  const baseWidth = bounds.maxX - bounds.minX + PADDING * 2
  const baseHeight = bounds.maxY - bounds.minY + nodeHeight + PADDING * 2

  const rootNode = nodes.find((node) => node.parentId == null) || nodes[0]
  // If Everything node is selected, reset lastFocusedIdRef to root
  // If Everything node is selected, reset pan and drag offsets to center
  // Only update lastFocusedIdRef synchronously
  if (selectedId !== null) {
    lastFocusedIdRef.current = selectedId;
  }

  // Removed effect that reset pan/drag offsets when root node is selected
  // Always center on root if selectedId is root, even after deep node
  let focusId;
  if (focusedElement !== null) {
    // When navigating with arrow keys, center on the focused node (takes priority)
    focusId = focusedElement.nodeId;
  } else if (selectedId !== null) {
    focusId = selectedId;
  } else if (lastFocusedIdRef.current !== null && lastFocusedIdRef.current === rootNode.id) {
    focusId = rootNode.id;
  } else {
    focusId = lastFocusedIdRef.current ?? rootNode?.id;
  }
  const focusNode = nodes.find((node) => node.id === focusId) || rootNode;
  const focusPos = layout.positions.get(focusNode?.id);
  
  // Use anchor size only when root is the focus (to prevent drift when children added)
  // For deep nodes or when resizing, use actual visible viewport dimensions
  // When root is focused with no selection, use current viewport to allow re-centering on resize
  const isRootFocus = focusNode.id === rootNode.id
  const hasSelection = selectedId !== null
  const rootFocusedNoSelection = isRootFocus && !hasSelection
  
  // Get the actual viewport dimensions - use clientWidth synchronously if available (not relying on ResizeObserver timing)
  // The ResizeObserver might not update synchronously with window resize events
  const mapPanelElement = mapPanelRef.current
  const actualViewportWidth = mapPanelElement?.clientWidth ?? viewportSize.width
  const actualViewportHeight = mapPanelElement?.clientHeight ?? viewportSize.height
  
  const visibleViewportWidth = actualViewportWidth > 0 ? actualViewportWidth : (windowSize.width - 40)
  // Calculate the height of the mobile header spacer if present (final adjustment: do not subtract from center)
  const mobileHeaderSpacerHeight = isMobile && !isFullscreenMode ? 120 : 0;
  const effectiveHeaderHeight = isFullscreenMode ? 0 : headerHeight;
  // Subtract the mobile spacer height from the vertical center calculation on mobile
  const visibleViewportHeight = actualViewportHeight > 0
    ? actualViewportHeight
    : (windowSize.height - effectiveHeaderHeight);
  
  // Always use current viewport size for centering, with anchorSizeRef/canvasSize as fallback
  const centerWidth = visibleViewportWidth || anchorSizeRef.current.width || canvasSize.width
  const centerHeight = visibleViewportHeight || anchorSizeRef.current.height || canvasSize.height
  
  // Account for fixed side panel taking up visual space on the right
  // The side panel is position: fixed, so it doesn't reduce map-panel width but takes up screen space
  // Calculate approximate side-panel width when open using the same clamp logic as CSS: clamp(200px, 58vw, 700px)
  const sidePanelWidthWhenOpen = panelOpen ? Math.max(200, Math.min(windowSize.width * 0.58, 700)) : 0
  
  // Visual center point accounts for the side-panel pushing the center left
  // The visible map area is from 0 to (centerWidth - sidePanelWidth), so center it there
  const centerX = centerWidth ? (centerWidth - sidePanelWidthWhenOpen) / 2 : baseWidth / 2
  // Center the focused node vertically in the visible area
  // On mobile, shift the center upward by the full mobile header spacer height ONLY when root is focused
  const centerY = centerHeight ? centerHeight / 2 : baseHeight / 2
  const focusCenterX = focusPos
    ? focusPos.x + baseOffsetX + nodeWidth / 2
    : baseOffsetX + nodeWidth / 2
  const focusCenterY = focusPos
    ? focusPos.y + baseOffsetY + nodeHeight / 2
    : baseOffsetY + nodeHeight / 2

  // Apply centering shift when:
  // 1. Initially loading (root centered)
  // 2. A node is currently selected
  // 3. Root is focused (to re-center on viewport resize)
  // 4. Arrow keys changed focus (focusedElement changed)
  // When deselecting a non-root node, keep the last applied shift to avoid camera jumps
  const initialLoad = prevSelectedIdRef.current === null && selectedId === null
  const rootIsFocused = selectedId === null && focusNode.id === rootNode.id
  const focusedNodeChanged = JSON.stringify(prevFocusedElementRef.current) !== JSON.stringify(focusedElement) && focusedElement !== null
  let shiftX, shiftY;
  const shouldApplyShift = selectedId !== null || initialLoad || rootIsFocused || forceRecenter || focusedNodeChanged;
  const nextShiftX = centerX - focusCenterX;
  const nextShiftY = centerY - focusCenterY;
  if (shouldApplyShift) {
    lastShiftRef.current = { x: nextShiftX, y: nextShiftY };
    shiftX = nextShiftX;
    shiftY = nextShiftY;
  } else {
    shiftX = lastShiftRef.current.x;
    shiftY = lastShiftRef.current.y;
  }

  if (selectedId !== prevSelectedIdRef.current) {
    prevSelectedIdRef.current = selectedId
  }

  if (JSON.stringify(focusedElement) !== JSON.stringify(prevFocusedElementRef.current)) {
    prevFocusedElementRef.current = focusedElement
  }

  const baseOffsetXCentered = baseOffsetX + shiftX
  const baseOffsetYCentered = baseOffsetY + shiftY

  // Always apply pan/drag offsets so dragging with a selected node does not snap back to recenter
  const safe = (v) => Number.isFinite(v) ? v : 0;
  let offsetX = safe(baseOffsetXCentered) - safe(basePanOffset?.x) - safe(dragOffset?.x);
  let offsetY = safe(baseOffsetYCentered) - safe(basePanOffset?.y) - safe(dragOffset?.y);

  // Offset reset effect for root node removed to avoid interfering with drag logic

  // (Removed accidental top-level code. All logic is inside App function.)
  // Calculate stable bounds without drag offset (only non-hidden nodes for accurate ceiling)
  const visibleNodeIdSet = new Set(nodes.filter(n => n.hidden !== true).map(n => n.id))
  let finalMinX = 0
  let finalMaxX = 0
  let finalMinY = 0
  let finalMaxY = 0
  layout.positions.forEach((pos, id) => {
    if (!visibleNodeIdSet.has(id)) return
    const left = pos.x + baseOffsetXCentered
    const right = pos.x + baseOffsetXCentered + nodeWidth
    const top = pos.y + baseOffsetYCentered
    const bottom = pos.y + baseOffsetYCentered + nodeHeight
    finalMinX = Math.min(finalMinX, left)
    finalMaxX = Math.max(finalMaxX, right)
    finalMinY = Math.min(finalMinY, top)
    finalMaxY = Math.max(finalMaxY, bottom)
  })
  
  // Add padding only if nodes go negative
  // But when focusing on a child node, don't apply renderOffset - allow ancestors to go off-screen
  const renderOffsetX = (finalMinX < 0 && focusNode.id === rootNode.id) ? -finalMinX + PADDING / 2 : 0
  const renderOffsetY = (finalMinY < 0 && focusNode.id === rootNode.id) ? -finalMinY + PADDING / 2 : 0
  // Sync max upward pan limit into a ref so drag handlers always use the latest value.
  // Canvas top is always at effectiveHeaderHeight on screen, so ceiling in canvas coords = 0.
  // Constraint: top of lowest node (canvas Y) >= 0
  // => totalPanY <= finalMaxY - nodeHeight + renderOffsetY
  maxPanYRef.current = Math.max(0, finalMaxY - nodeHeight + renderOffsetY)

  // Calculate actual SVG bounds
  const svgWidth = Math.max(finalMaxX + renderOffsetX + PADDING / 2, viewportSize.width || 1000)
  const svgHeight = Math.max(finalMaxY + renderOffsetY + PADDING / 2, viewportSize.height || 800)

  const mapWidth = svgWidth
  const mapHeight = svgHeight

  // For each node, check if its top edge is above the header (search bar)
  // Hide any node whose top is at or above the header
  const nodeScreenY = (node, customOffsetY = offsetY) => {
    const pos = layout.positions.get(node.id);
    if (!pos) return 0;
    return pos.y + customOffsetY + renderOffsetY;
  };

  // Do not clamp vertical pan: allow content to move behind the header region.
  // To prevent pop/re-overlap artifacts while dragging, never fall back to showing hidden nodes.
  // Viewport culling: only render nodes visible in viewport (with buffer for smooth panning)
  // Increase buffer for mobile devices to ensure distant nodes render during drag/pan
  // Use the hook-based isMobile from useMobileHeaderSpacer
  const VIEWPORT_BUFFER = isMobile ? 2000 : 500; // Larger buffer for mobile
  // Disable viewport culling for mobile devices to render all nodes
  const renderableNodes = nodes.filter((node) => {
    if (node.hidden === true) return false;
    if (isMobile) return true;
    const pos = layout.positions.get(node.id);
    if (!pos) return true;
    const screenX = pos.x + offsetX + renderOffsetX;
    const screenY = pos.y + offsetY + renderOffsetY;
    if (screenY < 0) return false;
    const viewportLeft = -VIEWPORT_BUFFER;
    const viewportRight = windowSize.width + VIEWPORT_BUFFER;
    const viewportTop = -VIEWPORT_BUFFER;
    const viewportBottom = windowSize.height + VIEWPORT_BUFFER;
    if (screenX + nodeWidth < viewportLeft) return false;
    if (screenX > viewportRight) return false;
    if (screenY + nodeHeight < viewportTop) return false;
    if (screenY > viewportBottom) return false;
    return true;
  });
  const renderableNodeIds = new Set(renderableNodes.map((node) => node.id));
  const fileDownloadBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
  const passwordRuleChecks = useMemo(() => getPasswordRuleChecks(loginForm.password), [loginForm.password])
  const isPasswordCompliant = passwordRuleChecks.every((rule) => rule.met)

  // Separate set for edge rendering: only hide edges for nodes above header, not for horizontal off-screen nodes
  const nodesForEdgeRendering = nodes.filter((node) => {
    // Always exclude explicitly hidden nodes
    if (node.hidden === true) return false;
    
    const pos = layout.positions.get(node.id);
    if (!pos) return true;
    
    // Calculate node position on screen
    const screenY = pos.y + offsetY + renderOffsetY;
    
    // Only exclude nodes whose top edge is above the canvas top (behind the header)
    if (screenY < 0) return false;
    
    return true;
  });
  const nodeIdsForEdges = new Set(nodesForEdgeRendering.map((node) => node.id));

  // Determine if the root node is above the header (search bar)
  let isRootAboveHeader = false;
  if (rootNode) {
    const rootY = layout.positions.get(rootNode.id)?.y ?? 0;
    const rootScreenY = rootY + offsetY + renderOffsetY;
    isRootAboveHeader = rootScreenY < 0;
  }

  // Auth handlers
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setAuthError('Please fill in both email and password.')
      return
    }

    if (isSignUp && !isPasswordCompliant) {
      setAuthError('Password does not meet all requirements listed below.')
      return
    }

    setAuthError('')

    try {
      // Remove logging of sensitive information
      // console.log(loginForm.email, loginForm.password);
      const response = isSignUp 
        ? await authAPI.register(loginForm.email, loginForm.password)
        : await authAPI.login(loginForm.email, loginForm.password)

      setCurrentUser(response.user)
      localStorage.setItem('everything_user_email', response.user.email)
      setLoginForm({ email: '', password: '' })
      setAuthError('')
      setOpenTooltip(null)
      setIsSignUp(false)

      // Load user's saved map
      try {
        const mapData = await mapsAPI.getMap()
        if (mapData.nodes && mapData.nodes.length > 0) {
          const { nodes: normalizedNodes, changed } = normalizeLoadedNodes(mapData.nodes)
          if (changed) {
            await mapsAPI.saveMap(normalizedNodes)
          }
          // Ensure all nodes have hidden field
          const nodesWithHidden = normalizedNodes.map(node => 
            ('hidden' in node) ? node : { ...node, hidden: false }
          );
          setNodesFromBackend(collapseNodesToRoot(nodesWithHidden))
        }
      } catch (err) {
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
    }
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch (err) {
      console.log('Logout error:', err.message)
    }
    setCurrentUser(null)
    localStorage.removeItem('everything_user_email')
    setNodesFromBackend(INITIAL_NODES)
    setOpenTooltip(null)
  }

  useEffect(() => {
    const handleShortcut = async (event) => {
      if (event.key === 'Escape' && midPanAnchor) {
        setMidPanAnchor(null)
        return
      }

      if (isFullscreenMode && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setIsFullscreenMode(false)
        setShowFullscreenHint(false)
        return
      }

      if (deleteConfirmation) {
        const modalNavKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape']
        if (!modalNavKeys.includes(event.key)) return

        event.preventDefault()
        event.stopPropagation()

        if (event.key === 'Escape') {
          cancelDelete()
          return
        }

        if (event.key === 'Enter') {
          if (deleteModalChoice === 'delete') {
            confirmDelete()
          } else {
            cancelDelete()
          }
          return
        }

        setDeleteModalChoice((prev) => (prev === 'cancel' ? 'delete' : 'cancel'))
        return
      }

      const isSaveShortcut = (event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')
      if (isSaveShortcut) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // Handle Shift+Enter: add custom child node
      if (event.key === 'Enter' && event.shiftKey && (selectedId !== null || focusedElement !== null)) {
        event.preventDefault()
        const targetNodeId = focusedElement?.nodeId || selectedId
        if (targetNodeId !== null) {
          addCustomChild(targetNodeId)
        }
        return
      }

      // Handle Tab: indent grid if just created, otherwise add custom sibling node
      if (event.key === 'Tab' && (selectedId !== null || focusedElement !== null)) {
        event.preventDefault()
        const targetNodeId = focusedElement?.nodeId || selectedId
        if (targetNodeId !== null) {
          // Check if last created grid is in this node and indent it instead of creating sibling
          if (lastCreatedGridId) {
            const selectedNode = nodes.find((n) => n.id === targetNodeId)
            const lastNote = selectedNode?.notes?.[selectedNode.notes.length - 1]
            if (lastNote?.id === lastCreatedGridId) {
              updateNoteLevel(targetNodeId, lastCreatedGridId, 1)
              setLastCreatedGridId(null)
              return
            }
          }
          addCustomSibling(targetNodeId)
        }
        return
      }

      // Handle Escape: clear keyboard focus highlight
      if (event.key === 'Escape' && focusedElement !== null) {
        event.preventDefault()
        setFocusedElement(null)
        return
      }

      // Handle Enter key: select the focused node or expand dots
      if (event.key === 'Enter' && focusedElement !== null) {
        event.preventDefault()
        if (focusedElement.type === 'node') {
          setSelectedId(focusedElement.nodeId)
          setPanelOpen(true)
          setPanelExpanded(false)
          setFocusedElement(null)
        } else if (focusedElement.type === 'dots') {
          const expandedNodeId = focusedElement.nodeId
          const result = await addChildren(expandedNodeId)
          if (result?.expanded) {
            // Wait for layout to re-render, then focus the actual leftmost child
            setTimeout(() => {
              const currentLayout = layoutRef.current
              const visibleChildren = nodesRef.current.filter(n => n.parentId === expandedNodeId && !n.hidden)
              if (!visibleChildren.length) return
              let leftmost = visibleChildren[0]
              if (typeof currentLayout?.positions?.get === 'function') {
                let minX = Infinity
                for (const child of visibleChildren) {
                  const pos = currentLayout.positions.get(child.id)
                  if (pos && pos.x < minX) { minX = pos.x; leftmost = child }
                }
              }
              setFocusedElement({ nodeId: leftmost.id, type: 'node' })
            }, 150)
          } else {
            setFocusedElement(null)
          }
        }
        return
      }

      // Handle Delete key: delete custom node
      if (event.key === 'Delete' && selectedId !== null && isAuthenticated) {
        const selectedNode = nodes.find((n) => n.id === selectedId)
        if (selectedNode && selectedNode.isCustom) {
          event.preventDefault()
          deleteCustomNode(selectedId)
        }
        return
      }

      // Arrow key navigation: focus nodes and dots without selecting them
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (arrowKeys.includes(event.key) && (selectedId !== null || focusedElement !== null)) {
        const isGridInput = event.target.classList && event.target.classList.contains('grid-cell-input')
        const isTextEditable =
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.isContentEditable

        // If we're inside a grid cell input, handle grid navigation instead of node navigation
        if (isGridInput) {
          event.preventDefault()
          
          const currentCell = event.target
          const currentTd = currentCell.parentElement
          const currentTr = currentTd.parentElement
          const currentTbody = currentTr.parentElement
          
          let targetCell = null
          
          if (event.key === 'ArrowUp') {
            const prevRow = currentTr.previousElementSibling
            if (prevRow) {
              const cellIndex = Array.from(currentTr.children).indexOf(currentTd)
              targetCell = prevRow.children[cellIndex]?.querySelector('input')
            }
          } else if (event.key === 'ArrowDown') {
            const nextRow = currentTr.nextElementSibling
            if (nextRow) {
              const cellIndex = Array.from(currentTr.children).indexOf(currentTd)
              targetCell = nextRow.children[cellIndex]?.querySelector('input')
            }
          } else if (event.key === 'ArrowLeft') {
            const prevTd = currentTd.previousElementSibling
            if (prevTd) {
              targetCell = prevTd.querySelector('input')
            }
          } else if (event.key === 'ArrowRight') {
            const nextTd = currentTd.nextElementSibling
            if (nextTd) {
              targetCell = nextTd.querySelector('input')
            }
          }
          
          if (targetCell) {
            targetCell.focus()
            targetCell.select()
          }
          
          return
        }

        // If we're typing in a regular text field (notes, summary, etc.), keep normal caret movement.
        if (isTextEditable) {
          return
        }
        
        event.preventDefault()
        
        // Use focusedElement if set, otherwise use selectedId as the starting point
        let startNodeId, startType
        if (focusedElement !== null) {
          startNodeId = focusedElement.nodeId
          startType = focusedElement.type
        } else {
          startNodeId = selectedId
          startType = 'node'
        }
        
        const currentNode = nodes.find((n) => n.id === startNodeId)
        const currentPos = layout.positions.get(startNodeId)
        
        if (!currentNode || !currentPos) return
        
        // Special handling for Down/Up when navigating to/from dots
        if (event.key === 'ArrowDown') {
          if (startType === 'node' && hasKnownSubdivisions(currentNode.label)) {
            // Move from node to its dots
            setFocusedElement({ nodeId: startNodeId, type: 'dots' })
            return
          } else if (startType === 'dots') {
            // Move from dots to the next node
            startType = 'node' // Continue as if we're on the node for finding next
          }
        } else if (event.key === 'ArrowUp' && startType === 'dots') {
          // Move from dots back up to its node
          setFocusedElement({ nodeId: startNodeId, type: 'node' })
          return
        }
        
        // For Left/Right or normal Up/Down, navigate between nodes
        const siblings = nodes.filter((n) => n.parentId === currentNode.parentId && n.id !== startNodeId)
        
        let nextNode = null
        
        if (event.key === 'ArrowUp') {
          const siblingsAbove = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.y < currentPos.y
          })
          if (siblingsAbove.length > 0) {
            siblingsAbove.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.y - posA.y
            })
            nextNode = siblingsAbove[0]
          } else {
            const candidatesAbove = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.y < currentPos.y && n.id !== startNodeId
            })
            candidatesAbove.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.y - posA.y
            })
            nextNode = candidatesAbove[0]
          }
        } else if (event.key === 'ArrowDown') {
          const siblingsBelow = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.y > currentPos.y
          })
          if (siblingsBelow.length > 0) {
            siblingsBelow.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.y - posB.y
            })
            nextNode = siblingsBelow[0]
          } else {
            const candidatesBelow = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.y > currentPos.y && n.id !== startNodeId
            })
            candidatesBelow.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.y - posB.y
            })
            nextNode = candidatesBelow[0]
          }
        } else if (event.key === 'ArrowLeft') {
          const siblingsLeft = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.x < currentPos.x
          })
          if (siblingsLeft.length > 0) {
            siblingsLeft.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.x - posA.x
            })
            nextNode = siblingsLeft[0]
          } else {
            const candidatesLeft = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.x < currentPos.x && n.id !== startNodeId
            })
            candidatesLeft.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.x - posA.x
            })
            nextNode = candidatesLeft[0]
          }
        } else if (event.key === 'ArrowRight') {
          const siblingsRight = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.x > currentPos.x
          })
          if (siblingsRight.length > 0) {
            siblingsRight.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.x - posB.x
            })
            nextNode = siblingsRight[0]
          } else {
            const candidatesRight = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.x > currentPos.x && n.id !== startNodeId
            })
            candidatesRight.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.x - posB.x
            })
            nextNode = candidatesRight[0]
          }
        }
        
        if (nextNode) {
          setFocusedElement({ nodeId: nextNode.id, type: 'node' })
        }
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [selectedId, focusedElement, nodes, layout.positions, hasKnownSubdivisions, addChildren, addCustomChild, addCustomSibling, deleteCustomNode, isAuthenticated, deleteConfirmation, deleteModalChoice, isFullscreenMode])

  // Close search suggestions when clicking outside the search row
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRowRef.current && !searchRowRef.current.contains(event.target)) {
        setSearchSuggestions([])
        setHighlightedSuggestion(-1)
      }
    }

    if (searchSuggestions.length > 0) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [searchSuggestions.length])

  const generateSearchSuggestions = (query, activeWords = null) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSearchSuggestions([])
      setRelatedIdeas([])
      return
    }

    const validQueryWords = getValidQueryWords(trimmedQuery, activeWords)
    if (validQueryWords.length === 0) {
      setSearchSuggestions([])
      setHighlightedSuggestion(-1)
      return []
    }

    // If activeWords was provided (post-validation), the last partial word the user is still
    // typing may have been excluded from validation. Re-attach it so "age of r" still filters
    // out nodes that don't contain a word starting with "r".
    const allQueryTokens = extractWordTokens(trimmedQuery)
    const partialSuffix =
      activeWords !== null && allQueryTokens.length > validQueryWords.length
        ? allQueryTokens[allQueryTokens.length - 1]
        : null
    const wordsToMatch = partialSuffix ? [...validQueryWords, partialSuffix] : validQueryWords

    const lowerQuery = trimmedQuery.toLowerCase()
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matchesQuery = (label) => {
      const lowerLabel = label.toLowerCase()
      if (wordsToMatch.length === 1) {
        const word = wordsToMatch[0]
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label) || lowerLabel.startsWith(word)
      }
      return wordsToMatch.every((word) => {
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label)
      })
    }
    const allTopics = Object.keys(TOPIC_SUBDIVISIONS)
    
    // Get all topics (include both keys and their values)
    const allLabels = new Set(allTopics)
    Object.values(TOPIC_SUBDIVISIONS).forEach((children) => {
      children.forEach((child) => allLabels.add(child))
    })

    // Add custom nodes from current state
    nodes.forEach((node) => {
      if (typeof node.label === 'string' && node.label.trim()) {
        allLabels.add(node.label)
      }
    })

    const labels = Array.from(allLabels).filter((label) => typeof label === 'string')

    const suggestions = labels
      .filter(matchesQuery)
      .sort((a, b) => {
        const lowerA = a.toLowerCase()
        const lowerB = b.toLowerCase()
        
        // Prioritize exact starts with the full query or first word
        const aStartsFull = lowerA.startsWith(lowerQuery)
        const bStartsFull = lowerB.startsWith(lowerQuery)
        if (aStartsFull && !bStartsFull) return -1
        if (!aStartsFull && bStartsFull) return 1
        
        // For multi-word, prioritize labels where words appear in order
        if (wordsToMatch.length > 1) {
          const aInOrder = wordsToMatch.every((word, i) => {
            const idx = lowerA.indexOf(word)
            if (idx === -1) return false
            if (i === 0) return true
            const prevIdx = lowerA.indexOf(wordsToMatch[i - 1])
            return idx > prevIdx
          })
          const bInOrder = wordsToMatch.every((word, i) => {
            const idx = lowerB.indexOf(word)
            if (idx === -1) return false
            if (i === 0) return true
            const prevIdx = lowerB.indexOf(wordsToMatch[i - 1])
            return idx > prevIdx
          })
          if (aInOrder && !bInOrder) return -1
          if (!aInOrder && bInOrder) return 1
        }
        
        return a.localeCompare(b)
      })
      .slice(0, 8) // Limit to 8 suggestions

    setSearchSuggestions(suggestions)
    // Auto-select the first suggestion
    setHighlightedSuggestion(suggestions.length > 0 ? 0 : -1)
    
    return suggestions
  }

  const extractWordTokens = (value) => {
    if (typeof value !== 'string') return []
    const matches = value.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)
    return matches || []
  }

  const getValidQueryWords = (query, activeWords = null) => {
    if (Array.isArray(activeWords) && activeWords.length > 0) {
      return activeWords
        .filter((word) => typeof word === 'string' && word.trim())
        .map((word) => word.toLowerCase())
    }
    return extractWordTokens(query)
  }

  const isExactWordMatch = (results, token) => {
    if (!Array.isArray(results)) return false
    return results.some((item) => {
      if (!item || typeof item.word !== 'string') return false
      return item.word.toLowerCase() === token
    })
  }

  const isValidWord = async (token) => {
    if (!token) return false
    if (token === 'a' || token === 'i') return true
    if (token.length === 1) return false
    if (datamuseWordValidityCacheRef.current.has(token)) {
      return datamuseWordValidityCacheRef.current.get(token)
    }

    try {
      const response = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(token)}&max=12`)
      const data = await response.json()
      const valid = isExactWordMatch(data, token)
      datamuseWordValidityCacheRef.current.set(token, valid)
      return valid
    } catch (error) {
      // Conservative fallback: suppress suggestions if word validation is unavailable.
      datamuseWordValidityCacheRef.current.set(token, false)
      return false
    }
  }

  const getRealWordTokens = async (query) => {
    const tokens = extractWordTokens(query)
    if (tokens.length === 0) return []

    // If query doesn't end with whitespace, exclude the last token (still being typed)
    const trimmedQuery = query.trim()
    const endsWithSpace = query !== trimmedQuery && query.endsWith(' ')
    const tokensToValidate = endsWithSpace || tokens.length === 1 ? tokens : tokens.slice(0, -1)
    
    if (tokensToValidate.length === 0) return []

    const validity = await Promise.all(tokensToValidate.map((token) => isValidWord(token)))
    return tokensToValidate.filter((_, index) => validity[index])
  }

  const queryContainsOnlyRealWords = async (query) => {
    const realWords = await getRealWordTokens(query)
    return realWords.length > 0
  }

  const fetchDatamuseSuggestions = async (query, realWordTokens = null) => {
    const normalizedQuery = Array.isArray(realWordTokens) && realWordTokens.length > 0
      ? realWordTokens.join(' ')
      : query.trim().toLowerCase()
    if (!normalizedQuery) return []

    if (datamuseSuggestionCacheRef.current.has(normalizedQuery)) {
      return datamuseSuggestionCacheRef.current.get(normalizedQuery)
    }

    try {
      const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(normalizedQuery)}&max=8`)
      const data = await response.json()
      const suggestions = Array.isArray(data)
        ? data
            .map((item) => item?.word)
            .filter((word) => typeof word === 'string' && word.trim())
            .filter((word) => isSuggestionActionable(word))
        : []
      datamuseSuggestionCacheRef.current.set(normalizedQuery, suggestions)
      return suggestions
    } catch (error) {
      return []
    }
  }

  const mergeSuggestions = (localSuggestions, apiSuggestions) => {
    const merged = []
    const seen = new Set()

    ;[...(localSuggestions || []), ...(apiSuggestions || [])].forEach((item) => {
      if (typeof item !== 'string') return
      const trimmed = item.trim()
      if (!trimmed) return
      const key = trimmed.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      merged.push(trimmed)
    })

    return merged.slice(0, 8)
  }

  const findNodePath = (label) => {
    const target = String(label || '').trim().toLowerCase()
    if (!target) return null

    const visited = new Set()
    const search = (parentLabel, path) => {
      if (visited.has(parentLabel)) return null
      visited.add(parentLabel)

      if (parentLabel.toLowerCase() === target) {
        return path
      }

      const children = TOPIC_SUBDIVISIONS[parentLabel] || []
      for (const childLabel of children) {
        const result = search(childLabel, [...path, childLabel])
        if (result) return result
      }

      return null
    }

    return search('Everything', ['Everything'])
  }

  const isSuggestionActionable = (label) => {
    if (typeof label !== 'string' || !label.trim()) return false
    const searchTerm = label.trim().toLowerCase()
    const exactNodeExists = nodes.some((node) => typeof node.label === 'string' && (node.label.toLowerCase() === searchTerm || getDisplayLabel(node.label).toLowerCase() === searchTerm))
    if (exactNodeExists) return true
    return Boolean(findNodePath(searchTerm))
  }

  const generateRelatedIdeas = (query, currentSuggestions = [], activeWords = null) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setRelatedIdeas([])
      return
    }

    const lowerQuery = trimmedQuery.toLowerCase()
    const queryWords = getValidQueryWords(trimmedQuery, activeWords)
    if (queryWords.length === 0) {
      setRelatedIdeas([])
      return
    }
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matchesQuery = (label) => {
      const lowerLabel = label.toLowerCase()
      if (queryWords.length === 1) {
        const word = queryWords[0]
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label) || lowerLabel.startsWith(word)
      }
      return queryWords.every((word) => {
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label)
      })
    }
    const relatedSet = new Set()

    // Find the query in the taxonomy
    for (const [parent, children] of Object.entries(TOPIC_SUBDIVISIONS)) {
      if (parent.toLowerCase() === lowerQuery) {
        // If query is a parent, suggest its children
        children.forEach((child) => relatedSet.add(child))
        break
      }

      // If query is a child, find its parent and siblings
      if (children.some((child) => child.toLowerCase() === lowerQuery)) {
        // Add all siblings
        children.forEach((child) => {
          if (child.toLowerCase() !== lowerQuery) relatedSet.add(child)
        })
        // Add the parent
        relatedSet.add(parent)
        
        // Check if parent has a parent (grandparent)
        for (const [grandparent, siblingParents] of Object.entries(TOPIC_SUBDIVISIONS)) {
          if (siblingParents.includes(parent)) {
            relatedSet.add(grandparent)
            // Add aunt/uncle nodes
            siblingParents.forEach((sibling) => {
              if (sibling !== parent) relatedSet.add(sibling)
            })
            break
          }
        }
        break
      }
    }

    // Also add any custom nodes with keyword matching or connection
    // Use word boundary matching to avoid matching substrings
    nodes.forEach((node) => {
      if (typeof node.label !== 'string' || !node.label.trim()) return
      const hasOverlap = queryWords.every((keyword) => {
        const regex = new RegExp(`\\b${keyword}`, 'i')
        return regex.test(node.label) || node.label.toLowerCase().startsWith(keyword) || getDisplayLabel(node.label).toLowerCase().startsWith(keyword)
      })
      if (hasOverlap && !relatedSet.has(node.label)) {
        relatedSet.add(node.label)
      }
    })

    // Remove the query itself from related ideas
    for (const idea of Array.from(relatedSet)) {
      if (idea.toLowerCase() === lowerQuery) {
        relatedSet.delete(idea)
      }
    }

    // Convert to array and limit to 6
    let related = Array.from(relatedSet)

    // Fallback: if graph-based related ideas are empty, suggest substring matches
    if (related.length === 0) {
      const allLabels = new Set(Object.keys(TOPIC_SUBDIVISIONS))
      Object.values(TOPIC_SUBDIVISIONS).forEach((children) => {
        children.forEach((child) => allLabels.add(child))
      })

      // For multi-word queries, check if all words are present as whole words
      const matchesAllWords = (label) => {
        if (queryWords.length === 1) {
          // Check for word boundary match or starts with
          const word = queryWords[0]
          const regex = new RegExp(`\\b${word}`, 'i')
          return regex.test(label) || label.toLowerCase().startsWith(word)
        }
        // All query words must be present as whole words
        return queryWords.every(word => {
          const regex = new RegExp(`\\b${word}`, 'i')
          return regex.test(label)
        })
      }

      related = Array.from(allLabels)
        .filter((label) => typeof label === 'string')
        .filter(matchesAllWords)
        .filter((label) => label.toLowerCase() !== lowerQuery)
        .sort((a, b) => a.length - b.length || a.localeCompare(b))
    }

    // Final fallback: if still empty, use semantic keyword matching
    if (related.length === 0) {
      // Check TOPIC_KEYWORDS for semantic matches using word boundaries
      for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        const hasMatch = keywords.some((keyword) => {
          // For multi-word queries, require all words to prevent partial-query matches.
          if (queryWords.length > 1) {
            return queryWords.every(qWord => {
              if (qWord.length <= 5) return keyword === qWord
              if (qWord.length <= 8) return keyword.startsWith(qWord)
              // Use word boundary for longer queries
              const regex = new RegExp(`\\b${qWord}`, 'i')
              return regex.test(keyword) || keyword.startsWith(qWord)
            })
          }
          
          // Single-word query logic
          if (lowerQuery.length <= 5) {
            return keyword === lowerQuery
          }
          if (lowerQuery.length <= 8) {
            return keyword.startsWith(lowerQuery)
          }
          // Use word boundary for longer queries
          const regex = new RegExp(`\\b${lowerQuery}`, 'i')
          return regex.test(keyword) || keyword.startsWith(lowerQuery)
        })
        
        if (hasMatch) {
          related.push(topic)
          if (related.length >= 3) break
        }
      }
    }

    // Filter out topics already in search suggestions
    const suggestionSet = new Set(currentSuggestions.map(s => s.toLowerCase()))
    related = related.filter(idea => !suggestionSet.has(idea.toLowerCase()))

    // Any item that still matches the query belongs in the main matches section.
    const promotedMatches = related.filter((idea) => matchesQuery(idea))
    if (promotedMatches.length > 0) {
      const promotedSuggestions = mergeSuggestions(currentSuggestions, promotedMatches)
      setSearchSuggestions(promotedSuggestions)
      setHighlightedSuggestion(promotedSuggestions.length > 0 ? 0 : -1)
      const promotedSet = new Set(promotedMatches.map((item) => item.toLowerCase()))
      related = related.filter((idea) => !promotedSet.has(idea.toLowerCase()))
    }

    related = related.slice(0, 6)
    setRelatedIdeas(related)
  }

  const handleSearchInputChange = async (e) => {
    const value = e.target.value
    setSearchQuery(value)

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId

    if (searchDebounceTimeoutRef.current) {
      clearTimeout(searchDebounceTimeoutRef.current)
    }

    if (!value.trim()) {
      setHasValidSearchWords(false)
      setSearchSuggestions([])
      setRelatedIdeas([])
      setHighlightedSuggestion(-1)
      return
    }

    // Always show local query matches immediately, even before word validation.
    const localSuggestions = generateSearchSuggestions(value) || []
    setSearchSuggestions(localSuggestions)
    setHighlightedSuggestion(localSuggestions.length > 0 ? 0 : -1)

    // Suggested Topics should only appear after validated real-word input.
    setHasValidSearchWords(false)
    setRelatedIdeas([])

    searchDebounceTimeoutRef.current = setTimeout(async () => {
      const realWordTokens = await getRealWordTokens(value)
      const hasRealWords = realWordTokens.length > 0
      if (requestId !== searchRequestIdRef.current) return

      setHasValidSearchWords(hasRealWords)

      if (!hasRealWords) {
        setRelatedIdeas([])
        // Keep immediate local matches visible while typing incomplete words.
        setHighlightedSuggestion(localSuggestions.length > 0 ? 0 : -1)
        return
      }

      const validatedLocalSuggestions = generateSearchSuggestions(value, realWordTokens) || []

      const apiSuggestions = await fetchDatamuseSuggestions(value, realWordTokens)
      if (requestId !== searchRequestIdRef.current) return

      const suggestions = mergeSuggestions(validatedLocalSuggestions, apiSuggestions)
      setSearchSuggestions(suggestions)
      setHighlightedSuggestion(suggestions.length > 0 ? 0 : -1)
      generateRelatedIdeas(value, suggestions, realWordTokens)
    }, 200)
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    setSearchSuggestions([])
    setRelatedIdeas([])
    setHighlightedSuggestion(-1)
    // Trigger search after a short delay to ensure query is updated
    setTimeout(() => {
      handleSearchWithQuery(suggestion)
    }, 0)
  }

  const handleSearchWithQuery = (query) => {
    if (!query.trim()) return
    const searchTerm = query.toLowerCase()

    // First check if the node exists in the current tree
    let matchingNode = nodes.find((node) =>
      node.label.toLowerCase() === searchTerm || getDisplayLabel(node.label).toLowerCase() === searchTerm
    )

    if (matchingNode) {
      // Node exists, select it
      
      // Unhide the node, all its ancestors, and all siblings along the path
      const unhideNodeAndAncestors = (nodeId) => {
        setNodes((prevNodes) => {
          const nodesToUnhide = new Set()
          
          // Trace up the tree to find all ancestors and their siblings
          let currentId = nodeId
          while (currentId !== null) {
            nodesToUnhide.add(currentId)
            const currentNode = prevNodes.find(n => n.id === currentId)
            const parentId = currentNode?.parentId ?? null
            
            // Add all siblings of the current node
            if (parentId !== null) {
              const siblings = prevNodes.filter(n => n.parentId === parentId)
              siblings.forEach(sibling => nodesToUnhide.add(sibling.id))
            }
            
            currentId = parentId
          }
          
          // Update all nodes to unhide the necessary ones
          return prevNodes.map(node => 
            nodesToUnhide.has(node.id) ? { ...node, hidden: false } : node
          )
        })
      }
      
      unhideNodeAndAncestors(matchingNode.id)
      setBasePanOffset({ x: 0, y: 0 })
      setSelectedId(matchingNode.id)
      setPanelOpen(true)
      setSearchQuery('')
      setSearchSuggestions([])
      setRelatedIdeas([])
      return
    }

    const path = findNodePath(searchTerm)

    if (!path) {
      setNotification({
        message: 'Node not found.',
        type: 'error'
      })
      return
    }

    // Build all nodes needed to show this search result
    let nodesToAdd = []
    let latestNodeId = Math.max(nextId.current, ...nodes.map(n => n.id)) + 1

    // Expand each level of the path
    for (let i = 1; i < path.length; i++) {
      const parentLabel = path[i - 1]
      const childLabel = path[i]
      
      // Find the parent node in existing nodes
      const parentNode = nodes.find((n) => n.label === parentLabel) || 
                         nodesToAdd.find((n) => n.label === parentLabel)
      
      if (!parentNode) continue

      // Check if this child already exists
      const childExists = nodes.some((n) => n.label === childLabel && n.parentId === parentNode.id) ||
                          nodesToAdd.some((n) => n.label === childLabel && n.parentId === parentNode.id)
      
      if (!childExists) {
        // Get all siblings from the knowledge base
        const siblings = TOPIC_SUBDIVISIONS[parentLabel] || []
        
        // Add siblings if not already added
        for (const siblingLabel of siblings) {
          const alreadyExists = nodes.some((n) => n.label === siblingLabel && n.parentId === parentNode.id) ||
                                nodesToAdd.some((n) => n.label === siblingLabel && n.parentId === parentNode.id)
          
          if (!alreadyExists) {
            nodesToAdd.push({
              id: latestNodeId++,
              label: siblingLabel,
              parentId: parentNode.id,
              hidden: false,
            })
          }
        }
      }
    }

    // Add all new nodes to the tree
    if (nodesToAdd.length > 0) {
      setNodes((prev) => [...prev, ...nodesToAdd])
    }

    // Look up the node ID from our new nodes or existing nodes
    const targetNode = nodesToAdd.find((n) => n.label.toLowerCase() === searchTerm) ||
                       nodes.find((n) => n.label.toLowerCase() === searchTerm)
    
    if (targetNode) {
      setBasePanOffset({ x: 0, y: 0 })
      // Unhide the target node, all its ancestors, and all siblings along the path
      setTimeout(() => {
        setNodes((prevNodes) => {
          const nodesToUnhide = new Set()
          
          // Trace up the tree to find all ancestors and their siblings
          let currentId = targetNode.id
          while (currentId !== null) {
            nodesToUnhide.add(currentId)
            const currentNode = prevNodes.find(n => n.id === currentId)
            const parentId = currentNode?.parentId ?? null
            
            // Add all siblings of the current node
            if (parentId !== null) {
              const siblings = prevNodes.filter(n => n.parentId === parentId)
              siblings.forEach(sibling => nodesToUnhide.add(sibling.id))
            }
            
            currentId = parentId
          }
          
          // Update all nodes to unhide the necessary ones
          return prevNodes.map(node => 
            nodesToUnhide.has(node.id) ? { ...node, hidden: false } : node
          )
        })
      }, 0)
      
      setSelectedId(targetNode.id)
      setPanelOpen(true)
    }

    setSearchQuery('')
    setSearchSuggestions([])
  }

  // Drag handlers
    const clampPanOffset = (offset) => {
      const MAX_PAN_Y = 2000;
      const vw = viewportSize.width || 1920;
      // Right limit: allow scrolling until rightmost content is at the left edge
      const maxX = Math.max(2000, finalMaxX + renderOffsetX + PADDING);
      // Left limit: allow scrolling until leftmost content is at the right edge
      const minX = Math.min(-2000, finalMinX + renderOffsetX - vw - PADDING);
      return {
        x: Math.max(minX, Math.min(maxX, offset.x)),
        y: Math.max(-MAX_PAN_Y, Math.min(maxPanYRef.current, offset.y)),
      };
    };

  // Middle-click autoscroll RAF loop
  useEffect(() => {
    if (!midPanAnchor) {
      if (midPanRafRef.current) cancelAnimationFrame(midPanRafRef.current)
      return
    }
    const DEADZONE = 12
    const SPEED = 0.06
    const tick = () => {
      const pos = midPanMouseRef.current
      if (pos) {
        const dx = pos.x - midPanAnchor.x
        const dy = pos.y - midPanAnchor.y
        const velX = Math.abs(dx) > DEADZONE ? (dx - Math.sign(dx) * DEADZONE) * SPEED : 0
        const velY = Math.abs(dy) > DEADZONE ? (dy - Math.sign(dy) * DEADZONE) * SPEED : 0
        if (velX !== 0 || velY !== 0) {
          setBasePanOffset((prev) => clampPanOffset({ x: prev.x + velX, y: prev.y + velY }))
        }
      }
      midPanRafRef.current = requestAnimationFrame(tick)
    }
    midPanRafRef.current = requestAnimationFrame(tick)
    return () => { if (midPanRafRef.current) cancelAnimationFrame(midPanRafRef.current) }
  }, [midPanAnchor])

  // Mouse drag handlers
  const handleMapMouseDown = (e) => {
    if (e.button === 1) {
      e.preventDefault()
      if (midPanAnchor) {
        setMidPanAnchor(null)
      } else {
        midPanMouseRef.current = { x: e.clientX, y: e.clientY }
        setMidPanAnchor({ x: e.clientX, y: e.clientY })
      }
      return
    }
    if (midPanAnchor) {
      setMidPanAnchor(null)
    }
    if (e.button === 0) {
      e.preventDefault()
      didDragRef.current = false
      suppressClickRef.current = false
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      setDragButton(0)
      setDragOffset({ x: 0, y: 0 })
      setFocusedElement(null)
    }
  }
  const handleMapMouseMove = (e) => {
    if (midPanAnchor) {
      midPanMouseRef.current = { x: e.clientX, y: e.clientY }
    }
    if (dragStart) {
      const deltaX = dragStart.x - e.clientX
      const deltaY = dragStart.y - e.clientY
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        didDragRef.current = true
      }
      const clampedPreviewPan = clampPanOffset({
        x: basePanOffset.x + deltaX,
        y: basePanOffset.y + deltaY,
      })
      setDragOffset({
        x: clampedPreviewPan.x - basePanOffset.x,
        y: clampedPreviewPan.y - basePanOffset.y,
      })
    }
  }
  const handleMapMouseUp = (e) => {
    if (dragButton === 0 && dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
    }
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }
  const handleMapMouseLeave = () => {
    if (dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
      setDragOffset({ x: 0, y: 0 })
    }
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }

  // Touch drag handlers for mobile
  const handleMapTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      didDragRef.current = false
      suppressClickRef.current = false
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      setDragButton('touch')
      setDragOffset({ x: 0, y: 0 })
    }
  }
  const handleMapTouchMove = (e) => {
    if (dragStart && e.touches && e.touches.length === 1) {
      const deltaX = dragStart.x - e.touches[0].clientX
      const deltaY = dragStart.y - e.touches[0].clientY
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        didDragRef.current = true
      }
      const clampedPreviewPan = clampPanOffset({
        x: basePanOffset.x + deltaX,
        y: basePanOffset.y + deltaY,
      })
      setDragOffset({
        x: clampedPreviewPan.x - basePanOffset.x,
        y: clampedPreviewPan.y - basePanOffset.y,
      })
    }
  }
  const handleMapTouchEnd = (e) => {
    if (dragButton === 'touch' && dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
      setRecenterKey((k) => k + 1);
    }
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }
  const handleMapTouchCancel = () => {
    if (dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
      setDragOffset({ x: 0, y: 0 })
    }
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }

  // Attach touch handlers imperatively with { passive: false } so preventDefault works
  const touchHandlersRef = useRef({})
  touchHandlersRef.current = {
    start: handleMapTouchStart,
    move: handleMapTouchMove,
    end: handleMapTouchEnd,
    cancel: handleMapTouchCancel,
  }
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onStart = (e) => touchHandlersRef.current.start(e)
    const onMove = (e) => touchHandlersRef.current.move(e)
    const onEnd = (e) => touchHandlersRef.current.end(e)
    const onCancel = (e) => touchHandlersRef.current.cancel(e)
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onCancel)
    const onWheel = (e) => {
      e.preventDefault()
      isZoomingSetterRef.current(true)
      clearTimeout(zoomTimeoutRef.current)
      zoomTimeoutRef.current = setTimeout(() => isZoomingSetterRef.current(false), 150)
      adjustNodeSizeRef.current(e.deltaY < 0 ? NODE_SIZE_STEP : -NODE_SIZE_STEP)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
      el.removeEventListener('wheel', onWheel)
    }
  }, []) // runs once; always reads latest handlers via touchHandlersRef

  return (
    <div className={`app-shell${isFullscreenMode ? ' fullscreen-mode' : ''}`} style={{ '--header-height': `${effectiveHeaderHeight}px` }}>
      {/* Spacer for mobile: must be outside the fixed header to push content down */}
      {isMobile && !isFullscreenMode && (
        <div className="mobile-header-spacer" style={{ height: `${headerHeight || 120}px`, minHeight: `${headerHeight || 120}px` }} />
      )}
      {!isFullscreenMode && (
        <header className="app-header" ref={headerRef}>
          <div className="title-block">
          <div className="title-stack" aria-label="Everything">
            <h1 className="title">
              <span className="cool-e">E</span>verything
            </h1>
            <p className="title-sub title-grid" aria-hidden="true">
              <span className="title-left title-bottom">Knowledge</span>
              <span className="title-right title-bottom">Mapped</span>
            </p>
          </div>
          <div className="search-row" ref={searchRowRef}>
            <form onSubmit={(e) => {
              e.preventDefault()
              handleSearchWithQuery(searchQuery)
            }}>
            <input
              ref={searchInputRef}
              className="search-input"
              type="text"
              placeholder="Search ideas"
              aria-label="Search ideas"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={(e) => {
                const totalItems = searchSuggestions.length + relatedIdeas.length
                if (totalItems > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlightedSuggestion((prev) =>
                      prev < totalItems - 1 ? prev + 1 : prev
                    )
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHighlightedSuggestion((prev) =>
                      prev > 0 ? prev - 1 : prev
                    )
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    if (highlightedSuggestion >= 0) {
                      if (highlightedSuggestion < searchSuggestions.length) {
                        handleSuggestionClick(searchSuggestions[highlightedSuggestion])
                      } else {
                        const relatedIdx = highlightedSuggestion - searchSuggestions.length
                        if (relatedIdx >= 0 && relatedIdx < relatedIdeas.length) {
                          setSearchQuery(relatedIdeas[relatedIdx])
                          setRelatedIdeas([])
                          setTimeout(() => {
                            handleSearchWithQuery(relatedIdeas[relatedIdx])
                          }, 0)
                        }
                      }
                    } else {
                      handleSearchWithQuery(searchQuery)
                    }
                    return false
                  } else if (e.key === 'Escape') {
                    setSearchSuggestions([])
                    setHighlightedSuggestion(-1)
                  }
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSearchWithQuery(searchQuery)
                  return false
                }
              }}
              onBlur={() => {
                // Wait a bit before hiding suggestions to allow clicking
                setTimeout(() => setSearchSuggestions([]), 200)
                setTimeout(() => setRelatedIdeas([]), 200)
                setHighlightedSuggestion(-1)
              }}
            />
            <button className="search-button" type="submit">
              Search
            </button>
            {(searchSuggestions.length > 0 || relatedIdeas.length > 0) && (
              <div className="search-suggestions" ref={searchSuggestionsRef}>
                {searchSuggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion}
                    data-suggestion-index={idx}
                    className={
                      "suggestion-item" +
                      (idx === highlightedSuggestion ? " highlighted" : "")
                    }
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setHighlightedSuggestion(idx)}
                    onMouseLeave={() => setHighlightedSuggestion(-1)}
                  >
                    {suggestion}
                  </button>
                ))}
                {hasValidSearchWords && relatedIdeas.length > 0 && (
                  <div className="related-ideas">
                    <div className="related-ideas-title">Suggested Topics</div>
                    {relatedIdeas.map((idea, idx) => {
                      const highlightIdx = searchSuggestions.length + idx
                      return (
                        <button
                          key={idea}
                          data-suggestion-index={highlightIdx}
                          className={"suggestion-item related-idea-item" + (highlightIdx === highlightedSuggestion ? " highlighted" : "")}
                          type="button"
                          onClick={() => {
                            setSearchQuery(idea)
                            setRelatedIdeas([])
                            setTimeout(() => {
                              handleSearchWithQuery(idea)
                            }, 0)
                          }}
                          onMouseEnter={() => setHighlightedSuggestion(highlightIdx)}
                          onMouseLeave={() => setHighlightedSuggestion(-1)}
                        >
                          {idea}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {notification && (
              <div className={`notification notification-${notification.type} notification-under-search`}>
                <div className="notification-content">
                  <p>{notification.message}</p>
                  <button
                    className="notification-close"
                    onClick={() => setNotification(null)}
                    aria-label="Close notification"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            </form>
          </div>
        </div>
        <div className="top-left" ref={createModeButtonsRef}>
          <div className="top-button-group">
            <button
              className={`top-link ${createNodeMode === 'child' ? 'active' : ''}`}
              type="button"
              title="Click to enable, then click a node to create a child"
              onClick={() => toggleCreateNodeMode('child')}
            >
              Add Child
            </button>
          </div>
          <div className="top-button-group">
            <button
              className={`top-link ${createNodeMode === 'sibling' ? 'active' : ''}`}
              type="button"
              title="Click to enable, then click a node to create a sibling"
              onClick={() => toggleCreateNodeMode('sibling')}
            >
              Add Sibling
            </button>
          </div>
        </div>
        <div className="top-right">
          <div className="top-button-group">
            <button 
              className="top-link" 
              type="button"
              onClick={() => window.open('/help-diagram.html', '_blank')}
            >
              Help
            </button>
          </div>

          <div className="top-button-group">
            <button 
              className="top-link" 
              type="button"
              onClick={() => setOpenTooltip(openTooltip === 'settings' ? null : 'settings')}
            >
              Settings
            </button>
            {openTooltip === 'settings' && (
              <div className="tooltip settings-tooltip">
                <h3>Settings</h3>
                <label className="setting-item">
                  <input 
                    type="checkbox" 
                    checked={enableAnimations}
                    onChange={(e) => setEnableAnimations(e.target.checked)}
                  />
                  Enable animations
                </label>
                <label className="setting-item">
                  <input 
                    type="checkbox" 
                    checked={smoothPanning}
                    onChange={(e) => setSmoothPanning(e.target.checked)}
                  />
                  Smooth panning
                </label>
                <label className="setting-item">
                  <input 
                    type="checkbox" 
                    checked={autoExpand}
                    onChange={(e) => setAutoExpand(e.target.checked)}
                  />
                  Auto-expand on search
                </label>
                <div className="setting-item setting-item-row" role="group" aria-label="Node size controls">
                  <span>Node size</span>
                  <div className="node-size-controls">
                    <button
                      type="button"
                      className="node-size-button"
                      onClick={() => adjustNodeSize(-NODE_SIZE_STEP)}
                      disabled={nodeSizeScale <= NODE_SIZE_MIN}
                      aria-label="Decrease node size"
                    >
                      -
                    </button>
                    <span className="node-size-value">{nodeSizePercent}%</span>
                    <button
                      type="button"
                      className="node-size-button"
                      onClick={() => adjustNodeSize(NODE_SIZE_STEP)}
                      disabled={nodeSizeScale >= NODE_SIZE_MAX}
                      aria-label="Increase node size"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="node-size-reset"
                      onClick={() => setNodeSizeScale(1)}
                      disabled={Math.abs(nodeSizeScale - 1) < 0.01}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="setting-item setting-item-row" role="group" aria-label="Fullscreen mode controls">
                  <span>Fullscreen mode</span>
                  <button
                    type="button"
                    className="node-size-reset"
                    onClick={toggleFullscreenMode}
                  >
                    {isFullscreenMode ? 'Exit' : 'Enter'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="top-button-group">
            <button 
              className="top-link" 
              type="button"
              onClick={async () => {
                const newState = openTooltip === 'profile' ? null : 'profile'
                setOpenTooltip(newState)
                if (newState === 'profile') {
                  setAuthError('')
                }
                if (newState === 'profile' && currentUser) {
                  try {
                    const usage = await filesAPI.getStorageUsage()
                    setStorageUsage(usage)
                  } catch (err) {
                    console.error('Failed to load storage usage:', err)
                  }
                }
              }}
            >
              Profile
            </button>
            {openTooltip === 'profile' && (
              <div className="tooltip profile-tooltip">
                {currentUser ? (
                  <>
                    <h3>Profile</h3>
                    <p className="profile-info">{currentUser.email}</p>
                    <p className="profile-detail">Signed in</p>
                    
                    {storageUsage && (
                      <div className="storage-section">
                        <div className="storage-header">
                          <span className="storage-label">Storage Usage</span>
                          <span className="storage-amount">{storageUsage.usedGB} / {storageUsage.limitGB} GB</span>
                        </div>
                        <div className="storage-bar">
                          <div 
                            className="storage-bar-fill storage-bar-files" 
                            style={{ width: `${(storageUsage.fileStorage / storageUsage.limit) * 100}%` }}
                            title={`Files: ${storageUsage.fileStorageGB} GB`}
                          />
                          <div 
                            className="storage-bar-fill storage-bar-notes" 
                            style={{ width: `${(storageUsage.mapStorage / storageUsage.limit) * 100}%` }}
                            title={`Notes/Nodes: ${storageUsage.mapStorageGB} GB`}
                          />
                        </div>
                        <div className="storage-legend">
                          <div className="storage-legend-item">
                            <span className="storage-legend-color storage-legend-files"></span>
                            <span className="storage-legend-text">Files ({storageUsage.fileStorageGB} GB)</span>
                          </div>
                          <div className="storage-legend-item">
                            <span className="storage-legend-color storage-legend-notes"></span>
                            <span className="storage-legend-text">Notes ({storageUsage.mapStorageGB} GB)</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <button 
                      className="profile-action profile-action-secondary" 
                      type="button"
                      onClick={() => alert('Storage upgrade coming soon!')}
                    >
                      Upgrade Storage
                    </button>
                    
                    <button 
                      className="profile-action" 
                      type="button"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <h3>{isSignUp ? 'Sign Up' : 'Sign In'}</h3>
                    <div className="auth-form">
                      <input
                        type="email"
                        placeholder="Email"
                        value={loginForm.email}
                        onChange={(e) => {
                          setLoginForm({ ...loginForm, email: e.target.value })
                          if (authError) setAuthError('')
                        }}
                        className="auth-input"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={loginForm.password}
                        onChange={(e) => {
                          setLoginForm({ ...loginForm, password: e.target.value })
                          if (authError) setAuthError('')
                        }}
                        className="auth-input"
                      />
                      {isSignUp && (
                        <div className="auth-password-requirements" aria-live="polite">
                          <p className="auth-password-title">Password requirements:</p>
                          <ul>
                            {passwordRuleChecks.map((rule) => (
                              <li key={rule.id} className={rule.met ? 'met' : 'unmet'}>
                                <span className="requirement-icon" aria-hidden="true">{rule.met ? '✓' : '✗'}</span>
                                <span>{rule.label}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {authError && (
                        <div className="auth-error" role="alert">
                          {authError}
                        </div>
                      )}
                      <button 
                        className="profile-action" 
                        type="button"
                        onClick={handleLogin}
                      >
                        {isSignUp ? 'Create Account' : 'Sign In'}
                      </button>
                      <button 
                        className="profile-action" 
                        type="button"
                        onClick={() => {
                          setIsSignUp(!isSignUp)
                          setAuthError('')
                        }}
                        style={{ background: 'transparent', opacity: 0.7 }}
                      >
                        {isSignUp ? 'Already have account?' : 'Need account?'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      )}

      {isFullscreenMode && showFullscreenHint && (
        <div className="fullscreen-exit-hint" role="status" aria-live="polite">
          Hit Esc to exit fullscreen mode
        </div>
      )}

      {showCreateNodeHint && createNodeMode && (
        <div
          className="create-node-hint"
          role="status"
          aria-live="polite"
          style={createNodeHintPosition ? {
            top: `${createNodeHintPosition.top}px`,
            left: `${createNodeHintPosition.left}px`,
          } : undefined}
        >
          {createNodeMode === 'child'
            ? 'Click the node you want to add a child to'
            : 'Click the node you want to add a sibling to'}
        </div>
      )}


      <main className="app-main" style={!isMobile && !isFullscreenMode && headerHeight ? { marginTop: headerHeight } : undefined}>
        <section className="map-panel" ref={mapPanelRef}>
          <div
            className="map-canvas"
            style={{
              cursor: midPanAnchor ? 'all-scroll' : isDragging ? 'grabbing' : 'grab'
            }}
            ref={canvasRef}
            onMouseDown={handleMapMouseDown}
            onMouseMove={handleMapMouseMove}
            onMouseUp={handleMapMouseUp}
            onMouseLeave={handleMapMouseLeave}
          >
            <div
              className="map-content"
              style={{
                width: mapWidth,
                height: mapHeight,
                transform: `translate(${offsetX}px, ${offsetY}px)`,
                transition: isDragging || !smoothPanning ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              <svg
                className="map-links"
                width={mapWidth}
                height={mapHeight}
                viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                overflow="visible"
                aria-hidden="true"
              >
                {layout.edges.map((edge) => {
                  // Hide lines when either connected node is hidden or above the header (but not horizontally off-screen)
                  if (!nodeIdsForEdges.has(edge.from) || !nodeIdsForEdges.has(edge.to)) {
                    return null;
                  }
                  // Skip edges involving the hidden root node if root is above header
                  if (isRootAboveHeader && (edge.from === rootNode.id || edge.to === rootNode.id)) {
                    return null;
                  }
                  const from = layout.positions.get(edge.from);
                  const to = layout.positions.get(edge.to);
                  if (!from || !to) return null;
                  const x1 = from.x + renderOffsetX + nodeWidth / 2;
                  const y1 = from.y + renderOffsetY + nodeHeight;
                  const x2 = to.x + renderOffsetX + nodeWidth / 2;
                  const y2 = to.y + renderOffsetY;
                  const dy = y2 - y1;
                  const d = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.35}, ${x2} ${y2 - dy * 0.35}, ${x2} ${y2}`;
                  return <path key={`${edge.from}-${edge.to}`} d={d} />;
                })}
              </svg>

              <div
                className="map-nodes"
                style={{ width: mapWidth, height: mapHeight }}
              >
                {renderableNodes.map((node) => {
                  const pos = layout.positions.get(node.id)
                  if (!pos) return null
                  const finalX = pos.x + renderOffsetX
                  const finalY = pos.y + renderOffsetY
                  const isRoot = node.parentId == null
                  return (
                    <div key={node.id}>
                      <div
                        className={`node-wrap${isRoot ? ' root-node' : ''}${transitionsEnabled && !isZooming ? '' : ' no-transition'}`}
                        style={{
                          left: finalX,
                          top: finalY,
                          width: nodeWidth,
                          height: nodeHeight,
                          transform: animatingIds.has(node.id) ? 'scale(0.8)' : 'scale(1)',
                          opacity: animatingIds.has(node.id) ? 0 : 1,
                          transition: isDragging || !smoothPanning ? 'none' : undefined,
                        }}
                        onMouseDown={(e) => {
                          if (e.button === 0) e.stopPropagation() // Only stop propagation for left-click
                        }}
                      >
                        <button
                          type="button"
                          className="node-card"
                          style={{
                            width: nodeWidth,
                            height: nodeHeight,
                            color: selectedId === node.id && panelOpen ? '#1d6fdc' : 'inherit',
                            backgroundColor: focusedElement?.nodeId === node.id && focusedElement?.type === 'node' ? 'rgba(29, 111, 220, 0.1)' : '#ffffff',
                            outline: focusedElement?.nodeId === node.id && focusedElement?.type === 'node' ? '2px solid #1d6fdc' : 'none',
                          }}
                          onMouseDown={(e) => {
                            if (e.button === 0) e.stopPropagation() // Only stop propagation for left-click
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            
                            // Handle button-based node creation for mobile users
                            if (createNodeMode === 'child') {
                              addCustomChild(node.id)
                              setCreateNodeMode(null)
                              setShowCreateNodeHint(false)
                              return
                            }
                            if (createNodeMode === 'sibling') {
                              addCustomSibling(node.id)
                              setCreateNodeMode(null)
                              setShowCreateNodeHint(false)
                              return
                            }
                            
                            // ...existing code...
                            // Toggle selection: if already selected, deselect; otherwise select and open panel
                            if (selectedId === node.id) {
                              setFocusedElement(null)
                              setSelectedId(null)
                              setPanelOpen(false)
                              setPanelExpanded(false)
                            } else {
                              setFocusedElement(null)
                              setPanelOpen(true)
                              setPanelExpanded(false)
                              setIsDragging(false)
                              setDragStart(null)
                              setDragButton(null)
                              setDragOffset({ x: 0, y: 0 })
                              setBasePanOffset({ x: 0, y: 0 })
                              setRecenterKey((k) => k + 1)
                              setSelectedId(node.id)
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (node.isCustom && isAuthenticated) {
                              setEditingNodeId(node.id)
                            }
                          }}
                        >
                          {editingNodeId === node.id ? (
                            <input
                              ref={(el) => {
                                editInputRef.current = el
                                if (el) {
                                  el.focus()
                                  el.select()
                                }
                              }}
                              type="text"
                              defaultValue={node.label}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                fontSize: 'inherit',
                                fontWeight: 'inherit',
                                fontFamily: 'inherit',
                                color: 'inherit',
                                textAlign: 'center',
                                padding: 0,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  updateNodeLabel(node.id, e.target.value)
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  setEditingNodeId(null)
                                }
                                e.stopPropagation()
                              }}
                              onBlur={(e) => {
                                updateNodeLabel(node.id, e.target.value)
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: getNodeFontSize(getDisplayLabel(node.label)) }}>{getDisplayLabel(node.label)}</span>
                          )}
                        </button>
                        {(hasKnownSubdivisions(node.label) || nodes.some((n) => n.parentId === node.id && n.isCustom)) ? (
                        <span
                          className="node-dots"
                          role="button"
                          tabIndex={0}
                          style={{
                            backgroundColor: focusedElement?.nodeId === node.id && focusedElement?.type === 'dots' ? 'rgba(29, 111, 220, 0.15)' : undefined,
                            outline: focusedElement?.nodeId === node.id && focusedElement?.type === 'dots' ? '2px solid #1d6fdc' : 'none',
                            borderRadius: focusedElement?.nodeId === node.id && focusedElement?.type === 'dots' ? '8px' : undefined,
                          }}
                          onMouseDown={(event) => {
                            if (event.button === 0) event.stopPropagation() // Only stop propagation for left-click
                          }}
                          onClick={async (event) => {
                            event.stopPropagation();
                            event.preventDefault();
                             // ...existing code...
                            await addChildren(node.id);
                          }}
                          onKeyDown={async (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              const result = await addChildren(node.id);
                              if (result?.expanded && result?.firstChildId) {
                                setForceRecenter(true);
                              }
                            }
                          }}
                          aria-label="Add child nodes"
                        >
                          <svg
                            className="dots-icon"
                            width="36"
                            height="12"
                            viewBox="0 0 36 12"
                            aria-hidden="true"
                          >
                            <circle cx="6" cy="6" r="4" />
                            <circle cx="18" cy="6" r="4" />
                            <circle cx="30" cy="6" r="4" />
                          </svg>
                        </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
        {selectedNode && panelOpen ? (
          <aside className={`side-panel${panelExpanded ? ' expanded' : ''}`}>
            <div className="panel-card">
              <div className="panel-header">
                {windowSize.width >= 768 && (
                  <button
                    className="panel-expand"
                    type="button"
                    onClick={() => setPanelExpanded(!panelExpanded)}
                    title={panelExpanded ? 'Collapse panel' : 'Expand panel'}
                  >
                    {panelExpanded ? '→' : '←'}
                  </button>
                )}
                {editingSidebarNodeId === selectedNode.id ? (
                  <input
                    key={`editing-${selectedNode.id}`}
                    ref={(el) => {
                      if (el) {
                        el.focus()
                        el.select()
                      }
                    }}
                    type="text"
                    defaultValue={selectedNode.label}
                    className="panel-title-input"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        updateNodeLabel(selectedNode.id, e.target.value)
                        setEditingSidebarNodeId(null)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditingSidebarNodeId(null)
                      }
                    }}
                    onBlur={(e) => {
                      updateNodeLabel(selectedNode.id, e.target.value)
                      setEditingSidebarNodeId(null)
                    }}
                  />
                ) : (
                  <h2
                    className={selectedNode.isCustom && isAuthenticated ? 'editable' : ''}
                    onClick={(e) => {
                      if (selectedNode.isCustom && isAuthenticated) {
                        e.stopPropagation()
                        setEditingSidebarNodeId(selectedNode.id)
                      }
                    }}
                    title={selectedNode.isCustom && isAuthenticated ? 'Click to edit title' : ''}
                  >
                    {selectedNode.label}
                  </h2>
                )}
                <button
                  className="panel-close"
                  type="button"
                  onClick={() => {
                    setPanelOpen(false)
                    setSelectedId(null)
                    setPanelExpanded(false)
                  }}
                >
                  X
                </button>
              </div>
              {selectedNode.isCustom && isAuthenticated ? (
                <div className="panel-summary-section">
                  {editingSummaryId === selectedNode.id ? (
                    <div>
                      <textarea
                        className="summary-textarea"
                        value={selectedNode.summary || ''}
                        onChange={(e) => updateNodeSummary(selectedNode.id, e.target.value)}
                        placeholder="Add a summary..."
                        rows={3}
                      />
                      <button
                        className="summary-save-button"
                        type="button"
                        onClick={() => setEditingSummaryId(null)}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <p 
                      className="panel-summary editable"
                      onClick={() => setEditingSummaryId(selectedNode.id)}
                      title="Click to edit summary"
                    >
                      {selectedNode.summary || 'Click to add a summary...'}
                    </p>
                  )}
                </div>
              ) : (
                generateSummary(selectedNode.label) && (
                  <p className="panel-summary">{generateSummary(selectedNode.label)}</p>
                )
              )}
              <div className="panel-notes">
                <div className="panel-notes-header">
                  <p className="panel-label">Notes</p>
                  {isAuthenticated ? (
                    <div className="panel-notes-actions">
                      <button
                        className="note-add-button"
                        type="button"
                        onClick={() => addNoteToNode(selectedNode.id)}
                        aria-label="Add note"
                        title="Add note"
                      >
                        +
                      </button>
                      <button
                        className="grid-add-button"
                        type="button"
                        onClick={() => addGridToNode(selectedNode.id)}
                        aria-label="Add grid"
                        title="Add grid"
                      >
                        ⊞
                      </button>
                    </div>
                  ) : null}
                </div>
                {selectedNode.notes && selectedNode.notes.length > 0 ? (
                  <div className="notes-list">
                    {selectedNode.notes.map((note) => (
                      note.type === 'grid' ? (
                        <div
                          key={note.id}
                          className="grid-item"
                          style={{ marginLeft: `${(Number.isFinite(note.level) ? note.level : 0) * 16}px` }}
                          onKeyDown={(event) => handleGridKeyDown(event, selectedNode.id, note.id, note)}
                          tabIndex={0}
                        >
                          <div className="grid-container">
                            <div className="grid-wrapper">
                              <table className="note-grid">
                                <tbody>
                                  {note.data.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                      {row.map((cell, colIdx) => (
                                        <td key={colIdx}>
                                          <input
                                            type="text"
                                            className="grid-cell-input"
                                            value={cell}
                                            onChange={(event) =>
                                              updateGridCell(selectedNode.id, note.id, rowIdx, colIdx, event.target.value)
                                            }
                                            placeholder=""
                                          />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {isAuthenticated ? (
                              <div className="grid-controls">
                                <div className="grid-size-controls">
                                  <div className="grid-control-group">
                                    <span className="grid-control-label">Rows:</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => removeGridRow(selectedNode.id, note.id)}
                                      disabled={note.rows <= 1}
                                      aria-label="Remove row"
                                    >
                                      −
                                    </button>
                                    <span className="grid-size-display">{note.rows}</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => addGridRow(selectedNode.id, note.id)}
                                      aria-label="Add row"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div className="grid-control-group">
                                    <span className="grid-control-label">Cols:</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => removeGridColumn(selectedNode.id, note.id)}
                                      disabled={note.cols <= 1}
                                      aria-label="Remove column"
                                    >
                                      −
                                    </button>
                                    <span className="grid-size-display">{note.cols}</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => addGridColumn(selectedNode.id, note.id)}
                                      aria-label="Add column"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="grid-delete-button"
                                  onClick={() => removeNoteFromNode(selectedNode.id, note.id)}
                                  aria-label="Delete grid"
                                  title="Delete grid"
                                >
                                  ×
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div
                          key={note.id}
                          className="note-item"
                          style={{ marginLeft: `${(Number.isFinite(note.level) ? note.level : 0) * 16}px` }}
                        >
                          <span className="note-bullet" aria-hidden="true">•</span>
                          <input
                            ref={(element) => {
                              if (element) {
                                noteInputRefs.current[note.id] = element
                              } else {
                                delete noteInputRefs.current[note.id]
                              }
                            }}
                            className="note-input personal-note"
                            value={note.text}
                            onChange={(event) =>
                              updateNoteText(selectedNode.id, note.id, event.target.value)
                            }
                            onKeyDown={(event) => handleNoteKeyDown(event, selectedNode.id, note)}
                            placeholder="Add a bullet point..."
                          />
                          {isAuthenticated ? (
                            <button
                              type="button"
                              className="note-delete-button"
                              onClick={() => removeNoteFromNode(selectedNode.id, note.id)}
                              aria-label="Delete note"
                              title="Delete note"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <p className="note-empty">
                    {isAuthenticated ? 'No notes yet.' : 'Sign in to add personal notes.'}
                  </p>
                )}
              </div>
              <div className="panel-files">
                <div className="panel-files-header">
                  <p className="panel-label">Files & Documents</p>
                  {isAuthenticated ? (
                    <label
                      className="file-upload-button"
                      title="Upload a file"
                      aria-label="Upload a file"
                    >
                      <input
                        type="file"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(selectedNode.id, file)
                            e.target.value = ''
                          }
                        }}
                        disabled={uploadingNodeId === selectedNode.id}
                      />
                      <svg
                        className="file-upload-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.82l8.49-8.48"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </label>
                  ) : null}
                </div>
                {nodeFiles[selectedNode.id] && nodeFiles[selectedNode.id].length > 0 ? (
                  <div className="files-list">
                    {nodeFiles[selectedNode.id].map((file) => (
                      <div key={file.id} className="file-item">
                        <a
                          href={`${fileDownloadBaseUrl}${file.downloadUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="file-link"
                          title={file.originalFilename}
                        >
                          📄 {file.originalFilename}
                        </a>
                        <button
                          className="file-delete-btn"
                          onClick={() => handleFileDelete(selectedNode.id, file.id)}
                          type="button"
                          title="Delete file"
                          aria-label="Delete file"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="file-empty">
                    {isAuthenticated ? 'No files yet.' : 'Sign in to add files.'}
                  </p>
                )}
              </div>
              {selectedNode.isCustom && isAuthenticated ? (
                <div className="panel-delete-section">
                  <button
                    className="delete-node-button"
                    type="button"
                    onClick={() => deleteCustomNode(selectedNode.id)}
                    title="Delete this custom node"
                  >
                    Delete node
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </main>

      {/* Sign In Required Modal */}
      {signInRequired && (
        <div className="modal-overlay" onClick={() => setSignInRequired(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sign In Required</h2>
              <button className="modal-close" onClick={() => setSignInRequired(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>{signInRequired}</p>
            </div>
            <div className="modal-footer">
              <button
                className="modal-button modal-button-cancel"
                onClick={() => setSignInRequired(null)}
              >
                Dismiss
              </button>
              <button
                className="modal-button modal-button-confirm"
                onClick={() => { setSignInRequired(null); setOpenTooltip('profile'); }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={cancelDelete}>✕</button>
            </div>
            <div className="modal-body">
              <p>{deleteConfirmation.message}</p>
            </div>
            <div className="modal-footer">
              <button
                ref={deleteCancelButtonRef}
                className="modal-button modal-button-cancel"
                onMouseEnter={() => setDeleteModalChoice('cancel')}
                onFocus={() => setDeleteModalChoice('cancel')}
                style={{ outline: deleteModalChoice === 'cancel' ? '2px solid #1d6fdc' : 'none' }}
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                ref={deleteConfirmButtonRef}
                className="modal-button modal-button-delete"
                onMouseEnter={() => setDeleteModalChoice('delete')}
                onFocus={() => setDeleteModalChoice('delete')}
                style={{ outline: deleteModalChoice === 'delete' ? '2px solid #1d6fdc' : 'none' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
