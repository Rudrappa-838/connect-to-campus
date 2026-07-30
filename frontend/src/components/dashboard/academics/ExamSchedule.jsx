import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../../api/axios';
import { toast } from 'react-hot-toast';
import { Calendar, Clock, Save, Hash, Plus, Printer, Trash2, RefreshCw, Edit2, Settings, X, Copy } from 'lucide-react';
import ExcelMarksManager from './ExcelMarksManager';

const ExamSchedule = ({ config }) => {
    // State
    const [loading, setLoading] = useState(false);
    const [examTypes, setExamTypes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');

    // Multi-select classes/sections
    const [targetClasses, setTargetClasses] = useState([]); // [{ class_id, section_id, class_name, section_name }]
    const [availableSubjects, setAvailableSubjects] = useState([]);

    // Schedule Data
    const [schedule, setSchedule] = useState([]);

    // Auto-Generate Configuration
    const [showAutoModal, setShowAutoModal] = useState(false);
    // subjectConfigs: { [subjectId]: { selected: boolean, date: string, startTime: string, endTime: string, components: [] } }
    const [subjectConfigs, setSubjectConfigs] = useState({});
    const [activeConfigSubject, setActiveConfigSubject] = useState(null); // { id, name, components }
    const [activeBatchFilter, setActiveBatchFilter] = useState(''); // 'NEET', 'JEE', 'KCET', or ''

    // Add Exam Type Modal
    const [showAddExamModal, setShowAddExamModal] = useState(false);
    const [newExamData, setNewExamData] = useState({ name: '', max_marks: 100, min_marks: 35, start_month: 1, end_month: 12 });
    const [showEditExamModal, setShowEditExamModal] = useState(false);
    const [editExamData, setEditExamData] = useState({ id: null, name: '', max_marks: 100, min_marks: 35, start_month: 1, end_month: 12 });

    // Single Schedule Item Edit
    const [editItem, setEditItem] = useState(null); // { id, date, startTime, endTime, components: [], subject_name, max_marks }
    const [showEditItemModal, setShowEditItemModal] = useState(false);

    // Add Class Modal State
    const [showAddClassModal, setShowAddClassModal] = useState(false);
    const [selectedNewClass, setSelectedNewClass] = useState('');
    const [selectedNewSection, setSelectedNewSection] = useState('');
    const [newClassSections, setNewClassSections] = useState([]);

    // Copy Timetable State
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copyExamName, setCopyExamName] = useState('');
    const [copyDateShift, setCopyDateShift] = useState(30);
    const [copyDateOverrides, setCopyDateOverrides] = useState({}); // { [subject_id]: 'YYYY-MM-DD' }
    const [copyTargetClasses, setCopyTargetClasses] = useState([]); // [{ class_id, section_id, class_name, section_name }]

    // Enhanced Copy states
    const [copySubjectList, setCopySubjectList] = useState([]); // [{ subject_id, subject_name, original_date, exam_date, is_dirty_date, start_time, end_time, max_marks, min_marks, components, target_batch }]
    const [copyClassSubjects, setCopyClassSubjects] = useState([]);
    const [copyingLoadingSubjects, setCopyingLoadingSubjects] = useState(false);
    const [selectedAddSubjectId, setSelectedAddSubjectId] = useState('');

    // Ref to suppress the auto-fetch when we intentionally set a new exam (e.g. after copy)
    const skipNextFetchRef = useRef(false);

    useEffect(() => {
        fetchExamTypes();
        fetchClasses();
    }, []);

    useEffect(() => {
        if (targetClasses.length > 0) {
            fetchSubjects();
        }
    }, [targetClasses]);

    useEffect(() => {
        if (selectedNewClass) {
            api.get(`/classes/${selectedNewClass}/sections`)
                .then(res => setNewClassSections(res.data))
                .catch(err => console.error('Failed to fetch sections for selectedNewClass:', err));
        } else {
            setNewClassSections([]);
        }
    }, [selectedNewClass]);

    useEffect(() => {
        if (selectedExam) {
            // If copy just set this exam, skip the DB fetch — we already have the schedule in state
            if (skipNextFetchRef.current) {
                skipNextFetchRef.current = false;
                return;
            }
            fetchExistingSchedule();
        } else {
            setSchedule([]);
        }
    }, [selectedExam]);

    useEffect(() => {
        if (showCopyModal) {
            fetchCopyTargetSubjects();
        } else {
            setCopyClassSubjects([]);
        }
    }, [copyTargetClasses, showCopyModal]);

    const fetchCopyTargetSubjects = async () => {
        if (copyTargetClasses.length === 0) {
            setCopyClassSubjects([]);
            setCopySubjectList([]);
            return;
        }

        setCopyingLoadingSubjects(true);
        try {
            const uniqueSubjects = new Map();
            for (const target of copyTargetClasses) {
                const url = target.section_id
                    ? `/classes/${target.class_id}/sections/${target.section_id}/subjects`
                    : `/classes/${target.class_id}/subjects`;
                const res = await api.get(url);
                res.data.forEach(sub => {
                    if (!uniqueSubjects.has(sub.id)) {
                        uniqueSubjects.set(sub.id, sub);
                    }
                });
            }
            const allTargetSubjects = Array.from(uniqueSubjects.values());
            setCopyClassSubjects(allTargetSubjects);

            // Create subject list from original schedule items that are valid for target classes
            const originalUniqueSubjects = [];
            const seen = new Set();
            schedule.forEach(item => {
                if (!seen.has(item.subject_id)) {
                    seen.add(item.subject_id);
                    originalUniqueSubjects.push(item);
                }
            });

            setCopySubjectList(prev => {
                const targetSubjectIds = new Set(allTargetSubjects.map(s => s.id));
                const preserved = prev.filter(item => targetSubjectIds.has(item.subject_id));

                const originalUniqueSubjectsInTarget = originalUniqueSubjects.filter(orig => 
                    targetSubjectIds.has(orig.subject_id) && !preserved.some(p => p.subject_id === orig.subject_id)
                );

                const newMapped = originalUniqueSubjectsInTarget.map(orig => {
                    const origDate = new Date(orig.exam_date + 'T00:00:00');
                    const shifted = new Date(origDate);
                    shifted.setDate(shifted.getDate() + (parseInt(copyDateShift) || 0));
                    const newDateStr = shifted.toISOString().split('T')[0];

                    return {
                        subject_id: orig.subject_id,
                        subject_name: orig.subject_name,
                        original_date: orig.exam_date,
                        exam_date: newDateStr,
                        is_dirty_date: false,
                        start_time: orig.start_time || '09:00',
                        end_time: orig.end_time || '12:00',
                        max_marks: orig.max_marks || 100,
                        min_marks: orig.min_marks || 35,
                        components: orig.components ? JSON.parse(JSON.stringify(orig.components)) : [],
                        target_batch: orig.target_batch || null
                    };
                });

                return [...preserved, ...newMapped];
            });

        } catch (error) {
            console.error("Error fetching target classes subjects:", error);
            toast.error("Failed to fetch subjects for target classes");
        } finally {
            setCopyingLoadingSubjects(false);
        }
    };

    const handleCopyDateShiftChange = (shiftValue) => {
        setCopyDateShift(shiftValue);
        const shift = parseInt(shiftValue) || 0;
        setCopySubjectList(prev => prev.map(item => {
            if (!item.is_dirty_date && item.original_date) {
                const origDate = new Date(item.original_date + 'T00:00:00');
                const shifted = new Date(origDate);
                shifted.setDate(shifted.getDate() + shift);
                return {
                    ...item,
                    exam_date: shifted.toISOString().split('T')[0]
                };
            }
            return item;
        }));
    };

    const handleCopyAddSubject = () => {
        if (!selectedAddSubjectId) return;
        const subId = parseInt(selectedAddSubjectId);
        const sub = copyClassSubjects.find(s => s.id === subId);
        if (!sub) return;

        if (copySubjectList.some(s => s.subject_id === subId)) {
            toast.error("Subject is already in the list");
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        setCopySubjectList(prev => [
            ...prev,
            {
                subject_id: sub.id,
                subject_name: sub.name,
                original_date: null,
                exam_date: todayStr,
                is_dirty_date: true,
                start_time: '09:00',
                end_time: '12:00',
                max_marks: 100,
                min_marks: 35,
                components: [],
                target_batch: null
            }
        ]);
        setSelectedAddSubjectId('');
        toast.success(`Added ${sub.name} to copy preview`);
    };

    const handleCopyDeleteSubject = (subjectId) => {
        setCopySubjectList(prev => prev.filter(s => s.subject_id !== subjectId));
        toast.success("Subject removed from copy preview");
    };

    const availableToCopyAdd = useMemo(() => {
        // Unique subjects of target classes minus subjects currently in copySubjectList
        const activeIds = new Set(copySubjectList.map(s => s.subject_id));
        return copyClassSubjects.filter(sub => !activeIds.has(sub.id));
    }, [copyClassSubjects, copySubjectList]);

    // Format time to 12-hour format
    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    const fetchExamTypes = async () => {
        try {
            const res = await api.get('/marks/exam-types');
            setExamTypes(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            setClasses(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSections = async (classId) => {
        try {
            const res = await api.get(`/classes/${classId}/sections`);
            setSections(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSubjects = async () => {
        if (targetClasses.length === 0) return;

        try {
            const subjectMap = new Map(); // lowercase_name -> { id: string, name: string, classSubjects: { [class_id]: sub_obj } }
            for (const target of targetClasses) {
                // Fetch subjects at the class level (robust, no section needed)
                const res = await api.get(`/classes/${target.class_id}/subjects`);
                res.data.forEach(sub => {
                    const key = sub.name.toLowerCase().trim();
                    if (!subjectMap.has(key)) {
                        subjectMap.set(key, {
                            id: key, // Use key as pseudo-id
                            name: sub.name,
                            classSubjects: {
                                [target.class_id]: sub
                            }
                        });
                    } else {
                        const existing = subjectMap.get(key);
                        existing.classSubjects[target.class_id] = sub;
                    }
                });
            }
            const uniqueSubs = Array.from(subjectMap.values());
            setAvailableSubjects(uniqueSubs);

            // Initialize subject configs
            const initialConfigs = {};
            uniqueSubs.forEach(sub => {
                initialConfigs[sub.id] = {
                    selected: false,
                    date: '',
                    startTime: '09:00',
                    endTime: '12:00',
                    components: [],
                    max_marks: 100,
                    min_marks: 35,
                    target_batch: ''
                };
            });
            setSubjectConfigs(initialConfigs);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddClass = (classId, sectionId) => {
        if (!classId || !sectionId) return;
        const cls = classes.find(c => c.id === parseInt(classId));
    };

    const fetchExistingSchedule = async () => {
        setLoading(true);
        try {
            const res = await api.get('/exam-schedule', {
                params: { exam_type_id: selectedExam }
            });
            const mapped = res.data.map(item => ({
                ...item,
                exam_date: item.exam_date.split('T')[0]
            }));
            setSchedule(mapped);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch existing schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = () => {
        const selectedSubs = Object.entries(subjectConfigs)
            .filter(([_, conf]) => conf.selected)
            .map(([id, conf]) => ({ id, ...conf }));

        if (selectedSubs.length === 0) {
            toast.error('Please select at least one subject');
            return;
        }

        const incomplete = selectedSubs.find(s => !s.date || !s.startTime || !s.endTime);
        if (incomplete) {
            toast.error('Please fill all date and time fields for selected subjects');
            return;
        }

        // Validate Min <= Max for all subjects
        for (const sub of selectedSubs) {
            if (parseFloat(sub.min_marks) > parseFloat(sub.max_marks)) {
                const subName = availableSubjects.find(s => s.id === sub.id)?.name;
                toast.error(`Subject '${subName}' Min Marks (${sub.min_marks}) cannot be greater than Max Marks (${sub.max_marks})`);
                return;
            }

            // Validate Components
            const comps = sub.components || [];
            if (comps.length > 0) {
                const totalMax = comps.reduce((sum, c) => sum + (parseFloat(c.max_marks) || 0), 0);
                const totalMin = comps.reduce((sum, c) => sum + (parseFloat(c.min_marks) || 0), 0);
                if (totalMax !== parseFloat(sub.max_marks)) {
                    const subName = availableSubjects.find(s => s.id === sub.id)?.name;
                    toast.error(`Subject '${subName}' components Max Marks (${totalMax}) must match Subject Max Marks (${sub.max_marks})`);
                    return;
                }
                if (totalMin !== parseFloat(sub.min_marks)) {
                    const subName = availableSubjects.find(s => s.id === sub.id)?.name;
                    toast.error(`Subject '${subName}' components Min Marks (${totalMin}) must match Subject Min Marks (${sub.min_marks})`);
                    return;
                }
            }
        }

        const newSchedule = [];
        targetClasses.forEach(cls => {
            selectedSubs.forEach(sub => {
                const availableSubObj = availableSubjects.find(s => s.id === sub.id);
                const classSub = availableSubObj?.classSubjects?.[cls.class_id];
                
                if (!classSub) return; // Skip if subject is not applicable to this class

                // Skip duplicates in schedule
                const isDuplicate = schedule.some(s =>
                    s.class_id === cls.class_id &&
                    (cls.section_id ? s.section_id === cls.section_id : !s.section_id) &&
                    s.subject_id === classSub.id
                );
                if (isDuplicate) return;

                newSchedule.push({
                    id: Date.now() + Math.random(),
                    data_new: true,
                    school_id: cls.school_id,
                    exam_type_id: parseInt(selectedExam),
                    class_id: cls.class_id,
                    section_id: cls.section_id,
                    subject_id: classSub.id, // Use actual class-specific subject ID
                    class_name: cls.class_name,
                    section_name: cls.section_name,
                    subject_name: classSub.name,
                    exam_date: sub.date,
                    start_time: sub.startTime,
                    end_time: sub.endTime,
                    max_marks: sub.max_marks,
                    min_marks: sub.min_marks,
                    components: sub.components,
                    target_batch: sub.target_batch
                });
            });
        });

        setSchedule([...schedule, ...newSchedule]);
        setShowAutoModal(false);
        toast.success(`Generated ${newSchedule.length} schedule items (Unsaved)`);
    };

    const handleBatchFilter = (batch) => {
        setActiveBatchFilter(batch);
        const newConfigs = { ...subjectConfigs };

        if (!batch) {
            Object.keys(newConfigs).forEach(id => {
                newConfigs[id].target_batch = '';
            });
            setSubjectConfigs(newConfigs);
            return;
        }

        const batchSubjects = {
            'NEET': ['biology', 'chemistry', 'physics'],
            'JEE': ['mathematics', 'physics', 'chemistry'],
            'KCET': ['mathematics', 'physics', 'chemistry', 'biology']
        };
        const reqSubjects = batchSubjects[batch] || [];

        availableSubjects.forEach(sub => {
            const isMatch = reqSubjects.includes(sub.name.toLowerCase().trim());
            newConfigs[sub.id] = {
                ...newConfigs[sub.id],
                selected: isMatch,
                target_batch: (isMatch && config?.has_exam_batches) ? batch : ''
            };
        });
        setSubjectConfigs(newConfigs);
    };

    // Generate schedule and immediately save to DB in one step
    const handleGenerateAndSave = async () => {
        if (!selectedExam) { toast.error('Select an exam first'); return; }

        const selectedSubs = Object.entries(subjectConfigs)
            .filter(([_, conf]) => conf.selected)
            .map(([id, conf]) => ({ id, ...conf }));

        if (selectedSubs.length === 0) { toast.error('Please select at least one subject'); return; }
        const incomplete = selectedSubs.find(s => !s.date || !s.startTime || !s.endTime);
        if (incomplete) { toast.error('Please fill all date and time fields for selected subjects'); return; }

        for (const sub of selectedSubs) {
            if (parseFloat(sub.min_marks) > parseFloat(sub.max_marks)) {
                const subName = availableSubjects.find(s => s.id === sub.id)?.name;
                toast.error(`Subject '${subName}' Min Marks cannot be greater than Max Marks`);
                return;
            }
            const comps = sub.components || [];
            if (comps.length > 0) {
                const totalMax = comps.reduce((sum, c) => sum + (parseFloat(c.max_marks) || 0), 0);
                const totalMin = comps.reduce((sum, c) => sum + (parseFloat(c.min_marks) || 0), 0);
                if (totalMax !== parseFloat(sub.max_marks)) {
                    const subName = availableSubjects.find(s => s.id === sub.id)?.name;
                    toast.error(`Subject '${subName}' components Max Marks must match Subject Max Marks (${sub.max_marks})`);
                    return;
                }
                if (totalMin !== parseFloat(sub.min_marks)) {
                    const subName = availableSubjects.find(s => s.id === sub.id)?.name;
                    toast.error(`Subject '${subName}' components Min Marks must match Subject Min Marks (${sub.min_marks})`);
                    return;
                }
            }
        }

        const newScheduleItems = [];
        targetClasses.forEach(cls => {
            selectedSubs.forEach(sub => {
                const availableSubObj = availableSubjects.find(s => s.id === sub.id);
                const classSub = availableSubObj?.classSubjects?.[cls.class_id];
                
                if (!classSub) return;

                // Skip duplicates in schedule
                const isDuplicate = schedule.some(s =>
                    !s.data_new && // Check against saved items
                    s.class_id === cls.class_id &&
                    (cls.section_id ? s.section_id === cls.section_id : !s.section_id) &&
                    s.subject_id === classSub.id
                );
                if (isDuplicate) return;

                newScheduleItems.push({
                    id: Date.now() + Math.random(),
                    school_id: cls.school_id,
                    exam_type_id: parseInt(selectedExam),
                    class_id: cls.class_id,
                    section_id: cls.section_id,
                    subject_id: classSub.id, // Use actual class-specific subject ID
                    class_name: cls.class_name,
                    section_name: cls.section_name,
                    subject_name: classSub.name,
                    exam_date: sub.date,
                    start_time: sub.start_time || sub.startTime,
                    end_time: sub.end_time || sub.endTime,
                    max_marks: sub.max_marks,
                    min_marks: sub.min_marks,
                    components: sub.components,
                    target_batch: sub.target_batch
                });
            });
        });

        // Combine existing saved items with newly generated ones
        const allItems = [...schedule.filter(s => !s.data_new), ...newScheduleItems];

        setLoading(true);
        try {
            const payload = allItems.map(item => ({
                exam_type_id: parseInt(selectedExam),
                class_id: item.class_id,
                section_id: item.section_id,
                subject_id: item.subject_id,
                exam_date: item.exam_date,
                start_time: item.start_time,
                end_time: item.end_time,
                max_marks: item.max_marks || 100,
                min_marks: item.min_marks || 35,
                components: item.components || [],
                target_batch: item.target_batch || null
            }));
            await api.post('/exam-schedule/save', { schedules: payload, delete_existing: true });
            setShowAutoModal(false);
            toast.success(`✅ Schedule saved! ${newScheduleItems.length} entries created.`);
            fetchExistingSchedule(); // Refresh from DB to get server-assigned IDs
        } catch (error) {
            toast.error('Failed to save schedule');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClassToSchedule = async () => {
        // Allow proceeding if no sections exist for the class
        if (!selectedNewClass || (newClassSections.length > 0 && !selectedNewSection)) {
            toast.error("Please select Class (and Section if available)");
            return;
        }

        // 1. Get Subjects for the new class
        let classSubjects = [];
        try {
            const url = selectedNewSection
                ? `/classes/${selectedNewClass}/sections/${selectedNewSection}/subjects`
                : `/classes/${selectedNewClass}/subjects`;

            const res = await api.get(url);
            classSubjects = res.data; // Array of {id, name, ...}
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch subjects for selected class");
            return;
        }

        // 2. Identify Unique Subjects in Current Schedule
        // Map SubjectID -> Template Item (to copy Date/Time/Marks)
        const templates = new Map();
        schedule.forEach(item => {
            // Only take the first occurrence of a subject to use as template
            if (!templates.has(item.subject_id)) {
                templates.set(item.subject_id, item);
            }
        });

        // 3. Match & Generate
        const newItems = [];
        let skippedDuplicates = 0;

        const clsId = parseInt(selectedNewClass);
        const secId = selectedNewSection ? parseInt(selectedNewSection) : null;

        const targetCls = classes.find(c => c.id == clsId);
        const targetSec = newClassSections.find(s => s.id == secId);

        classSubjects.forEach(sub => {
            if (templates.has(sub.id)) {

                // Check for duplicates in existing schedule
                const isDuplicate = schedule.some(s =>
                    s.class_id === clsId &&
                    (secId ? s.section_id === secId : !s.section_id) &&
                    s.subject_id === sub.id
                );

                if (isDuplicate) {
                    skippedDuplicates++;
                    return;
                }

                const tmpl = templates.get(sub.id);
                // Create new item
                newItems.push({
                    id: Date.now() + Math.random(), // Temp unique ID
                    school_id: tmpl.school_id,
                    exam_type_id: tmpl.exam_type_id,
                    class_id: clsId,
                    section_id: secId,
                    subject_id: sub.id,

                    // Display Names
                    class_name: targetCls?.name,
                    section_name: targetSec?.name || (secId ? 'Unknown Section' : 'No Section'),
                    subject_name: sub.name,

                    // Copied Schedule Config
                    exam_date: tmpl.exam_date,
                    start_time: tmpl.start_time,
                    end_time: tmpl.end_time,

                    // Copied Marks Config
                    max_marks: tmpl.max_marks,
                    min_marks: tmpl.min_marks,
                    components: tmpl.components ? JSON.parse(JSON.stringify(tmpl.components)) : [], // Deep copy
                    target_batch: tmpl.target_batch,

                    data_new: true // Mark as unsaved
                });
            }
        });

        if (newItems.length === 0) {
            if (skippedDuplicates > 0) {
                toast.error("Subject(s) already scheduled for this class and section");
            } else {
                toast.error("No matching subjects found between this Schedule and the selected Class");
            }
            return;
        }

        setSchedule(prev => [...prev, ...newItems]);
        setShowAddClassModal(false);
        toast.success(`Broadcasting schedule to ${targetCls?.name} - ${targetSec?.name} (${newItems.length} subjects match)`);
    };

    const handleSave = async () => {
        if (!selectedExam) {
            toast.error('Select an exam first');
            return;
        }
        if (schedule.length === 0) return;

        setLoading(true);
        try {
            const payload = schedule.map(item => ({
                exam_type_id: parseInt(selectedExam),
                class_id: item.class_id,
                section_id: item.section_id,
                subject_id: item.subject_id,
                exam_date: item.exam_date,
                start_time: item.start_time,
                end_time: item.end_time,
                max_marks: item.max_marks || 100,
                min_marks: item.min_marks || 35,
                components: item.components || [],
                target_batch: item.target_batch || null
            }));

            await api.post('/exam-schedule/save', {
                schedules: payload,
                delete_existing: true // Overwrite for these classes
            });
            toast.success('Exam schedule saved!');
        } catch (error) {
            toast.error('Failed to save schedule');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateScheduleItem = async () => {
        if (!editItem) return;

        // Validation: Min <= Max
        if (parseFloat(editItem.min_marks) > parseFloat(editItem.max_marks)) {
            toast.error(`Min (Pass) Marks (${editItem.min_marks}) cannot be greater than Max Marks (${editItem.max_marks})`);
            return;
        }

        // Validation: Components Total
        const totalMax = (editItem.components || []).reduce((sum, c) => sum + (parseFloat(c.max_marks) || 0), 0);
        const totalMin = (editItem.components || []).reduce((sum, c) => sum + (parseFloat(c.min_marks) || 0), 0);

        if (editItem.components.length > 0) {
            if (totalMax !== parseFloat(editItem.max_marks)) {
                toast.error(`Components Max Marks total (${totalMax}) must match Subject Max Marks (${editItem.max_marks})`);
                return;
            }
            if (totalMin !== parseFloat(editItem.min_marks)) {
                toast.error(`Components Min Marks total (${totalMin}) must match Subject Min Marks (${editItem.min_marks})`);
                return;
            }
        }

        if (editItem.data_new) {
            // Local Update Only (for unsaved items)
            setSchedule(prev => prev.map(s =>
                editItem.ids.includes(s.id) ? {
                    ...s,
                    exam_date: editItem.date,
                    start_time: editItem.startTime,
                    end_time: editItem.endTime,
                    components: editItem.components,
                    max_marks: parseFloat(editItem.max_marks) || 0,
                    min_marks: parseFloat(editItem.min_marks) || 0
                } : s
            ));
            toast.success('Schedule updated locally (Unsaved)');
            setShowEditItemModal(false);
            return;
        }

        try {
            const payload = {
                exam_date: editItem.date,
                start_time: editItem.startTime,
                end_time: editItem.endTime,
                components: editItem.components || [],
                max_marks: parseFloat(editItem.max_marks) || 0,
                min_marks: parseFloat(editItem.min_marks) || 0,
                ids: editItem.ids && editItem.ids.length > 0 ? editItem.ids : [editItem.id]
            };
            console.log("Sending Payload:", payload);

            await api.put(`/exam-schedule/${editItem.id}`, payload);

            toast.success('Schedule updated successfully');
            setShowEditItemModal(false);
            fetchExistingSchedule(); // Refresh list
        } catch (error) {
            console.error("Update failed:", error.response?.data || error);
            const msg = error.response?.data?.message || 'Failed to update schedule';
            toast.error(msg);
        }
    };

    const handleAddExamType = async () => {
        if (!newExamData.name.trim()) {
            toast.error('Please enter exam type name');
            return;
        }

        try {
            const res = await api.post('/marks/exam-types', {
                name: newExamData.name.trim(),
                max_marks: parseInt(newExamData.max_marks),
                min_marks: parseInt(newExamData.min_marks),
                start_month: parseInt(newExamData.start_month),
                end_month: parseInt(newExamData.end_month),
                weightage: 0
            });
            toast.success('Exam type added!');
            setExamTypes([...examTypes, res.data]);
            setSelectedExam(res.data.id);
            setNewExamData({ name: '', max_marks: 100, min_marks: 35, start_month: 1, end_month: 12 });
            setShowAddExamModal(false);
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to add exam type';
            toast.error(msg);
        }
    };

    const handleUpdateExamType = async () => {
        if (!editExamData.name.trim()) {
            toast.error('Please enter exam type name');
            return;
        }

        try {
            const res = await api.put(`/marks/exam-types/${selectedExam}`, {
                name: editExamData.name.trim(),
                max_marks: parseInt(editExamData.max_marks),
                min_marks: parseInt(editExamData.min_marks),
                start_month: parseInt(editExamData.start_month),
                end_month: parseInt(editExamData.end_month)
            });
            toast.success('Exam type updated!');
            setExamTypes(examTypes.map(e => e.id === parseInt(selectedExam) ? res.data : e));
            setEditExamData({ id: null, name: '', max_marks: 100, min_marks: 35, start_month: 1, end_month: 12 });
            setShowEditExamModal(false);
        } catch (error) {
            toast.error('Failed to update exam type');
            console.error(error);
        }
    };

    const handleDeleteExamType = async () => {
        if (!selectedExam) return;
        if (!window.confirm('Are you sure you want to delete this exam type? This will delete all associated schedules and marks.')) return;

        try {
            await api.delete(`/marks/exam-types/${selectedExam}`);
            toast.success('Exam type deleted successfully');
            setSelectedExam('');
            setSchedule([]);
            fetchExamTypes();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete exam type');
        }
    };

    // Copy current exam schedule to a brand-new exam type with shifted dates
    const handleCopyExam = async () => {
        if (!copyExamName.trim()) {
            toast.error('Please enter a name for the new exam');
            return;
        }
        if (copyTargetClasses.length === 0) {
            toast.error('Please select at least one class for the copy');
            return;
        }
        if (copySubjectList.length === 0) {
            toast.error('Please configure at least one subject to copy');
            return;
        }

        // Validate Subject Configs
        const incomplete = copySubjectList.find(s => !s.exam_date || !s.start_time || !s.end_time);
        if (incomplete) {
            toast.error(`Please fill date and time fields for all selected subjects (e.g. ${incomplete.subject_name})`);
            return;
        }

        for (const sub of copySubjectList) {
            if (parseFloat(sub.min_marks) > parseFloat(sub.max_marks)) {
                toast.error(`Subject '${sub.subject_name}' Min Marks (${sub.min_marks}) cannot be greater than Max Marks (${sub.max_marks})`);
                return;
            }
        }

        setLoading(true);
        try {
            // 1. Create new exam type copying parameters from the source
            const sourceExam = examTypes.find(e => e.id === parseInt(selectedExam));
            const res = await api.post('/marks/exam-types', {
                name: copyExamName.trim(),
                max_marks: sourceExam?.max_marks || 100,
                min_marks: sourceExam?.min_marks || 35,
                start_month: sourceExam?.start_month || 1,
                end_month: sourceExam?.end_month || 12,
                weightage: 0
            });
            const newExamType = res.data;

            let copiedSchedule = [];
            // Build entries for each selected class × each unique subject matching the class
            for (const cls of copyTargetClasses) {
                const url = cls.section_id
                    ? `/classes/${cls.class_id}/sections/${cls.section_id}/subjects`
                    : `/classes/${cls.class_id}/subjects`;
                const sRes = await api.get(url);
                const classSubjectIds = new Set(sRes.data.map(sub => sub.id));

                copySubjectList.forEach(item => {
                    if (classSubjectIds.has(item.subject_id)) {
                        copiedSchedule.push({
                            id: Date.now() + Math.random(),
                            school_id: sourceExam?.school_id || cls.school_id,
                            exam_type_id: newExamType.id,
                            class_id: cls.class_id,
                            section_id: cls.section_id,
                            subject_id: item.subject_id,
                            class_name: cls.class_name,
                            section_name: cls.section_name,
                            subject_name: item.subject_name,
                            exam_date: item.exam_date,
                            start_time: item.start_time,
                            end_time: item.end_time,
                            max_marks: item.max_marks,
                            min_marks: item.min_marks,
                            components: item.components ? JSON.parse(JSON.stringify(item.components)) : [],
                            target_batch: item.target_batch || null,
                            data_new: true
                        });
                    }
                });
            }

            if (copiedSchedule.length === 0) {
                // If no matching subjects, delete the newly created exam type to clean up
                await api.delete(`/marks/exam-types/${newExamType.id}`);
                toast.error('None of the target classes support the selected subjects');
                setLoading(false);
                return;
            }

            // 3. Save the copied schedule directly to DB
            const payload = copiedSchedule.map(item => ({
                exam_type_id: newExamType.id,
                class_id: item.class_id,
                section_id: item.section_id,
                subject_id: item.subject_id,
                exam_date: item.exam_date,
                start_time: item.start_time,
                end_time: item.end_time,
                max_marks: item.max_marks || 100,
                min_marks: item.min_marks || 35,
                components: item.components || [],
                target_batch: item.target_batch || null
            }));
            await api.post('/exam-schedule/save', { schedules: payload, delete_existing: true });

            // 4. Switch to new exam — useEffect will fetch the saved schedule from DB
            setExamTypes(prev => [...prev, newExamType]);
            setSelectedExam(newExamType.id.toString());
            setShowCopyModal(false);
            setCopyExamName('');
            setCopyDateShift(30);
            setCopyDateOverrides({});
            setCopyTargetClasses([]);
            setCopySubjectList([]);
            setCopyClassSubjects([]);
            toast.success(`✅ "${newExamType.name}" created and saved!`);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to copy exam');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = () => {
        const currentParams = examTypes.find(e => e.id === parseInt(selectedExam));
        if (currentParams) {
            setEditExamData({
                id: currentParams.id,
                name: currentParams.name,
                max_marks: currentParams.max_marks || 100,
                min_marks: currentParams.min_marks || 35,
                start_month: currentParams.start_month || 1,
                end_month: currentParams.end_month || 12
            });
            setShowEditExamModal(true);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Group the schedule for display
    const groupedSchedule = useMemo(() => {
        const filtered = targetClasses.length > 0
            ? schedule.filter(s => targetClasses.some(t => t.class_id == s.class_id && t.section_id == s.section_id))
            : schedule;

        const groups = {};

        filtered.forEach(item => {
            // Group by Subject + Date + Time
            const key = `${item.subject_id}-${item.exam_date}-${item.start_time}-${item.end_time}`;

            if (!groups[key]) {
                groups[key] = {
                    ...item, // Inherit props from first item
                    classes: [`${item.class_name} ${item.section_name || ''}`.trim()],
                    ids: [item.id]
                };
            } else {
                const clsName = `${item.class_name} ${item.section_name || ''}`.trim();
                // Avoid dupes in class list display
                if (!groups[key].classes.includes(clsName)) {
                    groups[key].classes.push(clsName);
                }
                groups[key].ids.push(item.id);
            }
        });

        // Sort by Date + Time
        return Object.values(groups).sort((a, b) => {
            const dateA = new Date(`${a.exam_date}T${a.start_time}`);
            const dateB = new Date(`${b.exam_date}T${b.start_time}`);
            return dateA - dateB;
        });
    }, [schedule, targetClasses]);

    // Helper to format Date
    const formatDate = (d) => new Date(d).toLocaleDateString();

    const today = new Date().toISOString().split('T')[0];

    const selectedExamType = examTypes.find(e => e.id === parseInt(selectedExam));

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Header / Selection */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
                {/* Row 1: Exam Type Selector */}
                <div className="flex flex-wrap items-end gap-3 mb-3">
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Exam Type</label>
                        <select
                            value={selectedExam}
                            onChange={(e) => setSelectedExam(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                        >
                            <option value="">-- Select Exam --</option>
                            {examTypes.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                        </select>
                    </div>
                    {/* Exam Type Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={openEditModal}
                            disabled={!selectedExam}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-bold transition-all"
                            title="Edit Exam Type"
                        >
                            <Edit2 size={15} /> <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                            onClick={() => setShowAddExamModal(true)}
                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-all"
                            title="Add New Exam Type"
                        >
                            <Plus size={15} /> <span className="hidden sm:inline">New Exam</span>
                        </button>
                        <button
                            onClick={handleDeleteExamType}
                            disabled={!selectedExam}
                            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-bold transition-all"
                            title="Delete Exam Type"
                        >
                            <Trash2 size={15} /> <span className="hidden sm:inline">Delete</span>
                        </button>
                        <button
                            onClick={() => {
                                const currentExam = examTypes.find(e => e.id === parseInt(selectedExam));
                                setCopyExamName(currentExam ? `${currentExam.name} (Copy)` : '');
                                setCopyDateShift(30);
                                setCopyDateOverrides({});
                                setCopyTargetClasses([]);
                                setCopySubjectList([]);
                                setCopyClassSubjects([]);
                                setSelectedAddSubjectId('');
                                setShowCopyModal(true);
                            }}
                            disabled={!selectedExam || schedule.length === 0 || schedule.some(s => s.data_new)}
                            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-bold transition-all"
                            title={schedule.some(s => s.data_new) ? 'Save the schedule first before copying' : 'Copy this exam schedule to a new exam'}
                        >
                            <Copy size={15} /> <span className="hidden sm:inline">Copy Exam</span>
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 my-2" />

                {/* Row 2: Target Classes + Action Buttons */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className={`flex-1 min-w-[200px] ${!selectedExam || (schedule.length > 0 && schedule.some(s => !s.data_new)) ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Classes</label>
                        <ClassMultiSelector
                            classes={classes}
                            onAdd={(cls) => setTargetClasses([...targetClasses, cls])}
                            onRemove={(idx) => setTargetClasses(targetClasses.filter((_, i) => i !== idx))}
                            selected={targetClasses}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 flex-shrink-0 print:hidden">
                        <button
                            onClick={() => setShowAutoModal(true)}
                            disabled={!selectedExam || (schedule.length > 0 && schedule.some(s => !s.data_new))}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                            title={!selectedExam ? "Select an exam type first" : (schedule.length > 0 && schedule.some(s => !s.data_new)) ? "Schedule already exists" : "Auto Generate Schedule"}
                        >
                            <RefreshCw size={16} /> Auto Generate
                        </button>
                        {schedule.length > 0 && (
                            <button
                                onClick={() => {
                                    setShowAddClassModal(true);
                                    setSelectedNewClass('');
                                    setSelectedNewSection('');
                                }}
                                disabled={!selectedExam}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                                title="Add Class to Schedule"
                            >
                                <Plus size={16} /> Add Class
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={schedule.length === 0 || loading}
                            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                        >
                            <Save size={16} /> Save
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={schedule.length === 0}
                            className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                        >
                            <Printer size={16} /> Print
                        </button>
                    </div>
                </div>
            </div>

            {/* Excel Bulk Marks Manager — show when exam is selected and has schedule */}
            {selectedExam && schedule.length > 0 && !schedule.some(s => s.data_new) && (
                <ExcelMarksManager examTypeId={selectedExam} />
            )}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col print:shadow-none print:border-none">

                <div className="p-4 border-b border-slate-200 flex flex-col gap-2 bg-slate-50 print:hidden">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-700">Exam Schedule Preview</h3>
                        <div className="text-sm text-slate-500">
                            {targetClasses.length > 0 ? (
                                <span>Showing filtered entries</span>
                            ) : (
                                <span>{schedule.length} entries</span>
                            )}
                        </div>
                    </div>
                    {/* Unique Classes List */}
                    <div className="flex flex-wrap gap-2">
                        {(() => {
                            // Helper to get unique class names
                            const unique = new Set();
                            (targetClasses.length > 0 ? targetClasses : schedule).forEach(s => {
                                const name = `${s.class_name || ''} ${s.section_name || ''}`.trim();
                                if (name) unique.add(name);
                            });
                            return Array.from(unique).map((name, i) => (
                                <span key={i} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-200">
                                    {name}
                                </span>
                            ));
                        })()}
                    </div>
                </div>

                <div className="overflow-auto flex-1 p-0 print:hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                            <tr>
                                <th className="p-3 border-b">Date</th>
                                <th className="p-3 border-b">Time</th>
                                <th className="p-3 border-b">Subject</th>
                                <th className="p-3 border-b">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {groupedSchedule.map((group) => (
                                <tr key={group.ids[0]} className="hover:bg-slate-50">

                                    <td className="p-3">
                                        <input
                                            type="date"
                                            value={group.exam_date}
                                            onChange={(e) => {
                                                setSchedule(prev => prev.map(s =>
                                                    group.ids.includes(s.id) ? { ...s, exam_date: e.target.value } : s
                                                ));
                                            }}
                                            className="border rounded px-2 py-1"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="time"
                                                    value={group.start_time}
                                                    onChange={(e) => {
                                                        setSchedule(prev => prev.map(s =>
                                                            group.ids.includes(s.id) ? { ...s, start_time: e.target.value } : s
                                                        ));
                                                    }}
                                                    className="border rounded px-2 py-1 w-24 text-xs"
                                                />
                                                <span className="text-xs text-slate-500">
                                                    ({formatTime12Hour(group.start_time)})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="time"
                                                    value={group.end_time}
                                                    onChange={(e) => {
                                                        setSchedule(prev => prev.map(s =>
                                                            group.ids.includes(s.id) ? { ...s, end_time: e.target.value } : s
                                                        ));
                                                    }}
                                                    className="border rounded px-2 py-1 w-24 text-xs"
                                                />
                                                <span className="text-xs text-slate-500">
                                                    ({formatTime12Hour(group.end_time)})
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 font-bold">{group.subject_name}</td>
                                    <td className="p-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditItem({
                                                        id: group.ids[0],
                                                        ids: group.ids,
                                                        data_new: group.data_new,
                                                        date: group.exam_date,
                                                        startTime: group.start_time,
                                                        endTime: group.end_time,
                                                        components: group.components || [],
                                                        subject_name: group.subject_name,
                                                        max_marks: group.max_marks || 100,
                                                        min_marks: group.min_marks || 35
                                                    });
                                                    setShowEditItemModal(true);
                                                }}
                                                className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                                                title="Edit Schedule Item"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => setSchedule(prev => prev.filter(s => !group.ids.includes(s.id)))}
                                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {schedule.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400">
                                        No schedule generated. Use Auto Generate to start.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Unsaved Changes Banner */}
                {schedule.some(s => s.data_new) && (
                    <div className="flex items-center justify-between gap-3 px-5 py-3 bg-amber-50 border-t-2 border-amber-400 print:hidden">
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl flex-shrink-0">⚠️</span>
                            <div>
                                <p className="font-bold text-sm text-amber-800">You have unsaved changes!</p>
                                <p className="text-xs text-amber-600">The schedule has been generated but not yet saved to the database.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-md flex-shrink-0"
                        >
                            <Save size={16} /> Save Now
                        </button>
                    </div>
                )}

                {/* Print View (Grouped by Class) */}
                <div className="hidden print:block p-4">
                    {/* Header for Print - Re-inserted here as it might be needed per page or just once at top (the top one handles general title) */}

                    {Object.values((targetClasses.length > 0
                        ? schedule.filter(s => targetClasses.some(t => t.class_id == s.class_id && t.section_id == s.section_id))
                        : schedule
                    ).reduce((acc, item) => {
                        const key = `${item.class_id}-${item.section_id}`;
                        if (!acc[key]) {
                            acc[key] = {
                                className: item.class_name,
                                sectionName: item.section_name,
                                items: []
                            };
                        }
                        acc[key].items.push(item);
                        return acc;
                    }, {})).map((group, idx) => (
                        <div key={idx} className="mb-8 break-inside-avoid page-break-after-always">
                            <div className="text-center mb-4 border-b pb-2 border-black">
                                <h2 className="text-xl font-bold uppercase">{selectedExamType?.name || 'Exam Schedule'}</h2>
                                <h3 className="text-lg font-bold">Class: {group.className}{group.sectionName ? ` - ${group.sectionName}` : ''}</h3>
                            </div>
                            <table className="w-full text-sm text-left mb-4 border-collapse border border-black">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black px-2 py-1 font-bold text-center w-32">Date</th>
                                        <th className="border border-black px-2 py-1 font-bold text-center w-32">Time</th>
                                        <th className="border border-black px-2 py-1 font-bold">Subject</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.items.sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date)).map(item => (
                                        <tr key={item.id}>
                                            <td className="border border-black px-2 py-1 text-center">{formatDate(item.exam_date)}</td>
                                            <td className="border border-black px-2 py-1 text-center">
                                                {formatTime12Hour(item.start_time)} - {formatTime12Hour(item.end_time)}
                                            </td>
                                            <td className="border border-black px-2 py-1 font-bold">{item.subject_name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>

            {/* Auto Generate Modal */}
            {
                showAutoModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-200">
                                <h3 className="font-bold text-lg">Configure Exam Schedule</h3>
                                <p className="text-sm text-slate-500">Select subjects and set their exam date and timing</p>
                                {config?.has_exam_batches && (
                                    <div className="mt-3 flex gap-2">
                                        <span className="text-sm font-bold text-slate-700 flex items-center mr-2">Auto Generate for:</span>
                                        <button
                                            onClick={() => handleBatchFilter('NEET')}
                                            className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${activeBatchFilter === 'NEET' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            NEET
                                        </button>
                                        <button
                                            onClick={() => handleBatchFilter('JEE')}
                                            className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${activeBatchFilter === 'JEE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            JEE
                                        </button>
                                        <button
                                            onClick={() => handleBatchFilter('KCET')}
                                            className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${activeBatchFilter === 'KCET' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            KCET
                                        </button>
                                        {activeBatchFilter && (
                                            <button
                                                onClick={() => handleBatchFilter('')}
                                                className="px-3 py-1 rounded text-xs font-bold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors ml-2"
                                            >
                                                Clear Filter
                                            </button>
                                        )}
                                    </div>
                                )}
                                {selectedExam && (
                                    <div className="mt-2 bg-blue-50 p-2 rounded text-xs text-blue-700 font-bold border border-blue-100 flex gap-4">
                                        <span className="text-indigo-600">
                                            Scheduled Period: {(() => {
                                                const dates = Object.values(subjectConfigs)
                                                    .filter(c => c.selected && c.date)
                                                    .map(c => new Date(c.date));

                                                if (dates.length === 0) return 'Select dates...';

                                                const min = new Date(Math.min(...dates));
                                                const max = new Date(Math.max(...dates));

                                                const minStr = min.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                                                const maxStr = max.toLocaleDateString('default', { month: 'short', year: 'numeric' });

                                                if (minStr === maxStr) return minStr;
                                                return `${minStr} - ${maxStr}`;
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 border-b w-10">
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        const newConfigs = { ...subjectConfigs };
                                                        Object.keys(newConfigs).forEach(id => {
                                                            newConfigs[id].selected = e.target.checked;
                                                        });
                                                        setSubjectConfigs(newConfigs);
                                                    }}
                                                />
                                            </th>
                                            <th className="p-3 border-b">Subject</th>
                                            <th className="p-3 border-b">Exam Date</th>
                                            <th className="p-3 border-b">Start Time</th>
                                            <th className="p-3 border-b">End Time</th>
                                            <th className="p-3 border-b">Components</th>
                                            <th className="p-3 border-b">Max</th> <th className="p-3 border-b">Min (Pass)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {availableSubjects.map(sub => {
                                            const cfg = subjectConfigs[sub.id] || { selected: false, date: '', startTime: '09:00', endTime: '12:00', max_marks: selectedExamType?.max_marks || 100, min_marks: selectedExamType?.min_marks || 35, target_batch: '' };

                                            // Calculate Min/Max Date for this Exam Type
                                            let minDate = '', maxDate = '';
                                            if (selectedExamType) {
                                                const year = new Date().getFullYear(); // Assume current year
                                                // Format: YYYY-MM-DD
                                                const sM = String(selectedExamType.start_month).padStart(2, '0');
                                                const eM = String(selectedExamType.end_month).padStart(2, '0');
                                                const eD = new Date(year, selectedExamType.end_month, 0).getDate(); // Last day of end month

                                                if (selectedExamType.start_month <= selectedExamType.end_month) {
                                                    minDate = `${year}-${sM}-01`;
                                                    maxDate = `${year}-${eM}-${eD}`;
                                                }
                                            }
                                            return (
                                                <tr key={sub.id} className={`${cfg.selected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} ${activeBatchFilter && !cfg.selected ? 'opacity-40 grayscale' : ''}`}>
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={cfg.selected}
                                                            onChange={(e) => {
                                                                setSubjectConfigs({
                                                                    ...subjectConfigs,
                                                                    [sub.id]: { ...cfg, selected: e.target.checked }
                                                                });
                                                            }}
                                                            className="w-4 h-4 text-indigo-600 rounded"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-medium">{sub.name}</td>
                                                    <td className="p-3">
                                                        <input
                                                            type="date"
                                                            disabled={!cfg.selected}
                                                            min={minDate}
                                                            max={maxDate}
                                                            value={cfg.date}
                                                            onChange={(e) => setSubjectConfigs({
                                                                ...subjectConfigs,
                                                                [sub.id]: { ...cfg, date: e.target.value }
                                                            })}
                                                            className="border rounded px-2 py-1 w-full disabled:opacity-50 disabled:bg-slate-100"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            type="time"
                                                            disabled={!cfg.selected}
                                                            value={cfg.startTime}
                                                            onChange={(e) => setSubjectConfigs({
                                                                ...subjectConfigs,
                                                                [sub.id]: { ...cfg, startTime: e.target.value }
                                                            })}
                                                            className="border rounded px-2 py-1 w-full disabled:opacity-50 disabled:bg-slate-100"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            type="time"
                                                            disabled={!cfg.selected}
                                                            value={cfg.endTime}
                                                            onChange={(e) => setSubjectConfigs({
                                                                ...subjectConfigs,
                                                                [sub.id]: { ...cfg, endTime: e.target.value }
                                                            })}
                                                            className="border rounded px-2 py-1 w-full disabled:opacity-50 disabled:bg-slate-100"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <button
                                                            onClick={() => setActiveConfigSubject({
                                                                id: sub.id,
                                                                name: sub.name,
                                                                components: cfg.components || [],
                                                                max_marks: cfg.max_marks,
                                                                min_marks: cfg.min_marks
                                                            })}
                                                            disabled={!cfg.selected}
                                                            className="flex items-center gap-1 text-sm bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded disabled:opacity-50 text-slate-700"
                                                        >
                                                            <Settings size={14} />
                                                            Configure ({cfg.components?.length || 0})
                                                        </button>
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            type="text"
                                                            disabled={!cfg.selected}
                                                            value={cfg.max_marks}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                setSubjectConfigs({
                                                                    ...subjectConfigs,
                                                                    [sub.id]: { ...cfg, max_marks: val }
                                                                });
                                                            }}
                                                            className="border rounded px-2 py-1 w-16 text-center disabled:opacity-50"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            type="text"
                                                            disabled={!cfg.selected}
                                                            value={cfg.min_marks}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                setSubjectConfigs({
                                                                    ...subjectConfigs,
                                                                    [sub.id]: { ...cfg, min_marks: val }
                                                                });
                                                            }}
                                                            className="border rounded px-2 py-1 w-16 text-center disabled:opacity-50"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {availableSubjects.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-8 text-center text-slate-400">
                                                    No subjects found. Please select classes first.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-2">
                                <button onClick={() => setShowAutoModal(false)} className="text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-sm">Cancel</button>
                                <button
                                    onClick={handleGenerateAndSave}
                                    disabled={loading}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all"
                                >
                                    <Save size={15} /> Save Schedule
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Exam Type Modal */}
            {
                showAddExamModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                            <div className="px-6 py-4 border-b border-slate-200">
                                <h3 className="font-bold text-lg">Add New Exam Type</h3>
                            </div>
                            <div className="p-6">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Exam Type Name</label>
                                    <input
                                        type="text"
                                        value={newExamData.name}
                                        onChange={(e) => setNewExamData({ ...newExamData, name: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. Final Exam"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
                                <button
                                    onClick={() => {
                                        setShowAddExamModal(false);
                                        setNewExamData({ name: '', max_marks: 100, min_marks: 35, start_month: 1, end_month: 12 });
                                    }}
                                    className="text-slate-600 hover:bg-slate-200 px-4 py-2 rounded font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddExamType}
                                    className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded font-bold"
                                >
                                    Add Exam Type
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Exam Type Modal */}
            {
                showEditExamModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                            <div className="px-6 py-4 border-b border-slate-200">
                                <h3 className="font-bold text-lg">Edit Exam Type</h3>
                            </div>
                            <div className="p-6">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Exam Type Name</label>
                                    <input
                                        type="text"
                                        value={editExamData.name}
                                        onChange={(e) => setEditExamData({ ...editExamData, name: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
                                <button
                                    onClick={() => {
                                        setShowEditExamModal(false);
                                        setEditExamData({ id: null, name: '', max_marks: 100, min_marks: 35, start_month: 1, end_month: 12 });
                                    }}
                                    className="text-slate-600 hover:bg-slate-200 px-4 py-2 rounded font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateExamType}
                                    className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded font-bold"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Component Config Modal */}
            {
                activeConfigSubject && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-lg">Exam Components: {activeConfigSubject.name}</h3>
                                <button onClick={() => setActiveConfigSubject(null)}><X size={20} /></button>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-slate-500 mb-4">
                                    Define mark breakdown (e.g. Theory: 80, Practical: 20).
                                </p>

                                {/* Subject Marks Inputs (Like Edit Modal) */}
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Subject Max Marks</label>
                                        <input
                                            type="text"
                                            value={activeConfigSubject.max_marks}
                                            onChange={(e) => setActiveConfigSubject({ ...activeConfigSubject, max_marks: e.target.value.replace(/[^0-9.]/g, '') })}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Subject Min (Pass)</label>
                                        <input
                                            type="text"
                                            value={activeConfigSubject.min_marks}
                                            onChange={(e) => setActiveConfigSubject({ ...activeConfigSubject, min_marks: e.target.value.replace(/[^0-9.]/g, '') })}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-60 overflow-y-auto mb-4 custom-scrollbar">
                                    {activeConfigSubject.components.map((comp, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder="Name (e.g. Theory)"
                                                value={comp.name}
                                                onChange={(e) => {
                                                    const newComps = [...activeConfigSubject.components];
                                                    newComps[idx].name = e.target.value;
                                                    setActiveConfigSubject({ ...activeConfigSubject, components: newComps });
                                                }}
                                                className="flex-1 border rounded px-2 py-1 text-sm"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Max"
                                                value={comp.max_marks}
                                                onChange={(e) => {
                                                    const newComps = [...activeConfigSubject.components];
                                                    newComps[idx].max_marks = e.target.value.replace(/[^0-9.]/g, '');
                                                    setActiveConfigSubject({ ...activeConfigSubject, components: newComps });
                                                }}
                                                className="w-16 border rounded px-2 py-1 text-sm"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Min"
                                                value={comp.min_marks}
                                                onChange={(e) => {
                                                    const newComps = [...activeConfigSubject.components];
                                                    newComps[idx].min_marks = e.target.value.replace(/[^0-9.]/g, '');
                                                    setActiveConfigSubject({ ...activeConfigSubject, components: newComps });
                                                }}
                                                className="w-16 border rounded px-2 py-1 text-sm"
                                            />
                                            <button
                                                onClick={() => {
                                                    const newComps = activeConfigSubject.components.filter((_, i) => i !== idx);
                                                    setActiveConfigSubject({ ...activeConfigSubject, components: newComps });
                                                }}
                                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setActiveConfigSubject({
                                        ...activeConfigSubject,
                                        components: [...activeConfigSubject.components, { name: '', max_marks: 0 }]
                                    })}
                                    className="text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded text-sm font-bold flex items-center gap-1"
                                >
                                    <Plus size={16} /> Add Component
                                </button>

                                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className={`font-bold ${activeConfigSubject.components.reduce((sum, c) => sum + (parseFloat(c.max_marks) || 0), 0) !== (parseFloat(subjectConfigs[activeConfigSubject.id]?.max_marks) || 100) ? 'text-amber-600' : 'text-green-600'}`}>
                                            Max Total: {activeConfigSubject.components.reduce((sum, c) => sum + (parseFloat(c.max_marks) || 0), 0)}
                                        </span>
                                        <span className={`font-bold ${activeConfigSubject.components.reduce((sum, c) => sum + (parseFloat(c.min_marks) || 0), 0) !== (parseFloat(subjectConfigs[activeConfigSubject.id]?.min_marks) || 35) ? 'text-amber-600' : 'text-green-600'}`}>
                                            Min Total: {activeConfigSubject.components.reduce((sum, c) => sum + (parseFloat(c.min_marks) || 0), 0)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            // Save everything EXACTLY as configured
                                            setSubjectConfigs({
                                                ...subjectConfigs,
                                                [activeConfigSubject.id]: {
                                                    ...subjectConfigs[activeConfigSubject.id],
                                                    components: activeConfigSubject.components,
                                                    max_marks: activeConfigSubject.max_marks,
                                                    min_marks: activeConfigSubject.min_marks
                                                }
                                            });
                                            setActiveConfigSubject(null);
                                        }}
                                        className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-bold w-full"
                                    >
                                        Done (Update Subject Marks)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div >
                )
            }

            {/* Add Class Modal */}
            {showAddClassModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Add Class to Schedule</h3>
                            <button onClick={() => setShowAddClassModal(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Select Class</label>
                                <select
                                    value={selectedNewClass}
                                    onChange={(e) => setSelectedNewClass(e.target.value)}
                                    className="w-full border p-2 rounded"
                                >
                                    <option value="">-- Class --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            {newClassSections.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold mb-1">Select Section</label>
                                    <select
                                        value={selectedNewSection}
                                        onChange={(e) => setSelectedNewSection(e.target.value)}
                                        className="w-full border p-2 rounded"
                                    >
                                        <option value="">-- Section --</option>
                                        {newClassSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="bg-blue-50 text-blue-700 p-3 rounded text-xs">
                                Note: This will copy scheduled subjects to the new class ONLY if the subjects match.
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button onClick={() => setShowAddClassModal(false)} className="px-4 py-2 rounded hover:bg-slate-100">Cancel</button>
                            <button onClick={handleAddClassToSchedule} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Add & Sync</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Single Schedule Item Modal */}
            {
                showEditItemModal && editItem && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-lg">Edit Schedule: {editItem.subject_name}</h3>
                                <button onClick={() => setShowEditItemModal(false)}><X size={20} /></button>
                            </div>
                            <div className="p-6 space-y-4">

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Exam Date</label>
                                    <input
                                        type="date"
                                        value={editItem.date}
                                        onChange={(e) => setEditItem({ ...editItem, date: e.target.value })}
                                        className="w-full border rounded px-3 py-2"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Start Time</label>
                                        <input
                                            type="time"
                                            value={editItem.startTime}
                                            onChange={(e) => setEditItem({ ...editItem, startTime: e.target.value })}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">End Time</label>
                                        <input
                                            type="time"
                                            value={editItem.endTime}
                                            onChange={(e) => setEditItem({ ...editItem, endTime: e.target.value })}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Subject Max Marks</label>
                                        <input
                                            type="text"
                                            value={editItem.max_marks}
                                            onChange={(e) => setEditItem({ ...editItem, max_marks: e.target.value.replace(/[^0-9.]/g, '') })}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Subject Min (Pass)</label>
                                        <input
                                            type="text"
                                            value={editItem.min_marks}
                                            onChange={(e) => setEditItem({ ...editItem, min_marks: e.target.value.replace(/[^0-9.]/g, '') })}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Components (Marks Breakdown)</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {(editItem.components || []).map((comp, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    value={comp.name}
                                                    onChange={(e) => {
                                                        const newComps = [...editItem.components];
                                                        newComps[idx].name = e.target.value;
                                                        setEditItem({ ...editItem, components: newComps });
                                                    }}
                                                    className="flex-1 border rounded px-2 py-1 text-sm"
                                                    placeholder="Name"
                                                />
                                                <input
                                                    type="number"
                                                    value={comp.max_marks}
                                                    onChange={(e) => {
                                                        const newComps = [...editItem.components];
                                                        newComps[idx].max_marks = e.target.value.replace(/[^0-9.]/g, '');
                                                        setEditItem({ ...editItem, components: newComps });
                                                    }}
                                                    className="w-16 border rounded px-2 py-1 text-sm"
                                                    placeholder="Max"
                                                />
                                                <input
                                                    type="number"
                                                    value={comp.min_marks}
                                                    onChange={(e) => {
                                                        const newComps = [...editItem.components];
                                                        newComps[idx].min_marks = e.target.value.replace(/[^0-9.]/g, '');
                                                        setEditItem({ ...editItem, components: newComps });
                                                    }}
                                                    className="w-16 border rounded px-2 py-1 text-sm"
                                                    placeholder="Min"
                                                />
                                                <button onClick={() => {
                                                    const newComps = editItem.components.filter((_, i) => i !== idx);
                                                    setEditItem({ ...editItem, components: newComps });
                                                }} className="text-red-500 hover:bg-red-50 p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setEditItem({
                                            ...editItem,
                                            components: [...(editItem.components || []), { name: '', max_marks: '', min_marks: '' }]
                                        })}
                                        className="text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded text-sm font-bold flex items-center gap-1 mt-2"
                                    >
                                        <Plus size={16} /> Add Component
                                    </button>
                                </div>

                                <div className="flex justify-between items-center text-sm pt-2">
                                    <span className={`font-bold ${(editItem.components || []).reduce((s, c) => s + (parseFloat(c.max_marks) || 0), 0) !== (parseFloat(editItem.max_marks) || 0) && (editItem.components || []).length > 0
                                        ? 'text-amber-600'
                                        : 'text-green-600'
                                        }`}>
                                        Components Total: {(editItem.components || []).reduce((s, c) => s + (parseFloat(c.max_marks) || 0), 0)} / {editItem.max_marks}
                                    </span>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <button onClick={() => setShowEditItemModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                                    <button onClick={handleUpdateScheduleItem} className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg font-bold">
                                        Update Schedule
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {showAddClassModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 print:hidden">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Add Class to Schedule</h3>
                            <button onClick={() => setShowAddClassModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Class</label>
                                <select
                                    value={selectedNewClass}
                                    onChange={e => {
                                        setSelectedNewClass(e.target.value);
                                        setSelectedNewSection('');
                                        if (e.target.value) {
                                            api.get(`/classes/${e.target.value}/sections`)
                                                .then(res => setNewClassSections(res.data))
                                                .catch(console.error);
                                        } else {
                                            setNewClassSections([]);
                                        }
                                    }}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select Class</option>
                                    {classes
                                        .slice()
                                        .sort((a, b) => {
                                            const numA = parseInt(a.name.replace(/\D/g, '') || '0', 10);
                                            const numB = parseInt(b.name.replace(/\D/g, '') || '0', 10);
                                            return numA === numB ? a.name.localeCompare(b.name) : numA - numB;
                                        })
                                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            {newClassSections.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Section</label>
                                    <select
                                        value={selectedNewSection}
                                        onChange={e => setSelectedNewSection(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        disabled={!selectedNewClass}
                                    >
                                        <option value="">Select Section</option>
                                        {newClassSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <p className="text-xs text-slate-500">
                                Only subjects common to the current schedule and the new class will be added.
                            </p>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowAddClassModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddClassToSchedule}
                                    disabled={!selectedNewClass || (newClassSections.length > 0 && !selectedNewSection)}
                                    className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-bold"
                                >
                                    Add Class
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Copy Timetable Modal */}
            {showCopyModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 print:hidden">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Copy size={20} className="text-purple-600" /> Copy Exam Schedule
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Duplicate &ldquo;{examTypes.find(e => e.id === parseInt(selectedExam))?.name}&rdquo; as a new exam type
                                </p>
                            </div>
                            <button onClick={() => { setShowCopyModal(false); setCopyDateOverrides({}); setCopyTargetClasses([]); setCopySubjectList([]); setCopyClassSubjects([]); setSelectedAddSubjectId(''); }} className="text-slate-400 hover:text-slate-700 mt-0.5">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto flex-1 font-sans">
                            {/* New Exam Name */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    New Exam Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={copyExamName}
                                    onChange={e => setCopyExamName(e.target.value)}
                                    placeholder="e.g. Term 2 Exam 2026"
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm font-medium"
                                />
                            </div>

                            {/* Date Shift */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Shift All Dates By (Days)</label>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <input
                                        type="number"
                                        value={copyDateShift}
                                        onChange={e => handleCopyDateShiftChange(e.target.value)}
                                        className="w-28 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none text-sm text-center font-bold"
                                    />
                                    <span className="text-sm text-slate-500 font-medium">
                                        {parseInt(copyDateShift) > 0
                                            ? `+${copyDateShift} days forward`
                                            : parseInt(copyDateShift) < 0
                                            ? `${copyDateShift} days backward`
                                            : 'Same dates (no shift)'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">You can also edit each subject's configuration individually in the table below.</p>
                            </div>

                            {/* Target Classes */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    Copy To Classes <span className="text-red-500">*</span>
                                    <span className="ml-2 text-slate-400 font-normal text-xs">(select at least 1 class)</span>
                                </label>
                                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                    <ClassMultiSelector
                                        classes={classes}
                                        selected={copyTargetClasses}
                                        onAdd={cls => setCopyTargetClasses(prev => [...prev, cls])}
                                        onRemove={idx => setCopyTargetClasses(prev => prev.filter((_, i) => i !== idx))}
                                    />
                                </div>
                                {copyTargetClasses.length === 0 && (
                                    <p className="text-xs text-red-500 font-medium mt-1">
                                        ⚠️ Please select at least one class to continue.
                                    </p>
                                )}
                                {copyTargetClasses.length > 0 && (
                                    <p className="text-xs text-indigo-600 font-medium mt-1">
                                        ✓ Schedule will be created for {copyTargetClasses.length} class{copyTargetClasses.length > 1 ? 'es' : ''} selected above.
                                    </p>
                                )}
                            </div>

                            {/* Live Preview Table */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Subject Schedule & Marks Preview</label>
                                {copyingLoadingSubjects ? (
                                    <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                                        <RefreshCw className="animate-spin text-purple-600" size={20} />
                                        <span className="text-sm font-medium">Fetching subjects for target classes...</span>
                                    </div>
                                ) : copyTargetClasses.length === 0 ? (
                                    <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-400 text-sm">
                                        Select at least one target class above to preview and edit subjects.
                                    </div>
                                ) : copySubjectList.length === 0 ? (
                                    <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-400 text-sm">
                                        No subjects scheduled. Add some subjects from the section below.
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700 font-bold">
                                                    <tr>
                                                        <th className="px-3 py-2">Subject</th>
                                                        <th className="px-3 py-2 w-24">Original Date</th>
                                                        <th className="px-3 py-2 w-32">→ New Date</th>
                                                        <th className="px-3 py-2 w-24">Start Time</th>
                                                        <th className="px-3 py-2 w-24">End Time</th>
                                                        <th className="px-3 py-2 w-16">Max</th>
                                                        <th className="px-3 py-2 w-16">Min</th>
                                                        <th className="px-2 py-2 text-center w-8"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {copySubjectList.map((item, i) => (
                                                        <tr key={i} className="hover:bg-purple-50/50">
                                                            <td className="px-3 py-1.5 font-bold text-slate-800">
                                                                {item.subject_name}
                                                            </td>
                                                            <td className="px-3 py-1.5 text-slate-400 font-medium">
                                                                {item.original_date || <span className="text-purple-600 font-semibold italic text-[10px]">New</span>}
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    type="date"
                                                                    value={item.exam_date}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setCopySubjectList(prev => prev.map(s =>
                                                                            s.subject_id === item.subject_id
                                                                                ? { ...s, exam_date: val, is_dirty_date: true }
                                                                                : s
                                                                        ));
                                                                    }}
                                                                    className="border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold outline-none w-full focus:ring-1 focus:ring-purple-400 text-slate-700"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    type="time"
                                                                    value={item.start_time}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setCopySubjectList(prev => prev.map(s =>
                                                                            s.subject_id === item.subject_id
                                                                                ? { ...s, start_time: val }
                                                                                : s
                                                                        ));
                                                                    }}
                                                                    className="border border-slate-300 rounded px-1.5 py-0.5 text-xs outline-none w-full focus:ring-1 focus:ring-purple-400 text-slate-700 font-medium"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    type="time"
                                                                    value={item.end_time}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setCopySubjectList(prev => prev.map(s =>
                                                                            s.subject_id === item.subject_id
                                                                                ? { ...s, end_time: val }
                                                                                : s
                                                                        ));
                                                                    }}
                                                                    className="border border-slate-300 rounded px-1.5 py-0.5 text-xs outline-none w-full focus:ring-1 focus:ring-purple-400 text-slate-700 font-medium"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    type="number"
                                                                    value={item.max_marks}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setCopySubjectList(prev => prev.map(s =>
                                                                            s.subject_id === item.subject_id
                                                                                ? { ...s, max_marks: val }
                                                                                : s
                                                                        ));
                                                                    }}
                                                                    className="border border-slate-300 rounded px-1 py-0.5 text-xs text-center outline-none w-full focus:ring-1 focus:ring-purple-400 text-slate-700 font-semibold"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    type="number"
                                                                    value={item.min_marks}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setCopySubjectList(prev => prev.map(s =>
                                                                            s.subject_id === item.subject_id
                                                                                ? { ...s, min_marks: val }
                                                                                : s
                                                                        ));
                                                                    }}
                                                                    className="border border-slate-300 rounded px-1 py-0.5 text-xs text-center outline-none w-full focus:ring-1 focus:ring-purple-400 text-slate-700 font-semibold"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1 text-center">
                                                                <button
                                                                    onClick={() => handleCopyDeleteSubject(item.subject_id)}
                                                                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                                                                    title="Delete Subject"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Add Additional Subjects Dropdown */}
                            {copyTargetClasses.length > 0 && availableToCopyAdd.length > 0 && (
                                <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 flex items-center justify-between gap-3">
                                    <div className="flex-1">
                                        <label className="block text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-1">Add Another Subject</label>
                                        <select
                                            value={selectedAddSubjectId}
                                            onChange={e => setSelectedAddSubjectId(e.target.value)}
                                            className="w-full px-2 py-1.5 border border-purple-200 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-xs bg-white font-medium text-slate-700"
                                        >
                                            <option value="">-- Select Subject to Add --</option>
                                            {availableToCopyAdd.map(sub => (
                                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleCopyAddSubject}
                                        disabled={!selectedAddSubjectId}
                                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 mt-4"
                                    >
                                        <Plus size={14} /> Add Subject
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={() => { setShowCopyModal(false); setCopyDateOverrides({}); setCopyTargetClasses([]); setCopySubjectList([]); setCopyClassSubjects([]); setSelectedAddSubjectId(''); }}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCopyExam}
                                disabled={loading || !copyExamName.trim() || copyTargetClasses.length === 0 || copySubjectList.length === 0}
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-sm"
                            >
                                <Copy size={15} /> Create &amp; Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
// ... ClassMultiSelector ...
const ClassMultiSelector = ({ classes, onAdd, onRemove, selected }) => {
    const [selClass, setSelClass] = useState('');
    const [selSection, setSelSection] = useState('');
    const [sections, setSections] = useState([]);
    const [loadingSections, setLoadingSections] = useState(false);

    useEffect(() => {
        if (selClass) {
            setLoadingSections(true);
            api.get(`/classes/${selClass}/sections`)
                .then(res => setSections(res.data))
                .catch(console.error)
                .finally(() => setLoadingSections(false));
        } else {
            setSections([]);
        }
    }, [selClass]);

    const handleAdd = () => {
        if (!selClass) return;
        // Allow if section selected OR if no sections exist/are loaded
        const noSections = sections.length === 0;
        if (!selSection && !noSections) return;

        // Prevent duplicates
        const secIdToSave = selSection ? parseInt(selSection) : null;

        if (selected.some(s => s.class_id === parseInt(selClass) && s.section_id === secIdToSave)) {
            toast.error('Class/Section already added');
            return;
        }

        const cls = classes.find(c => c.id === parseInt(selClass));
        const sec = sections.find(s => s.id === secIdToSave);

        onAdd({
            class_id: parseInt(selClass),
            section_id: secIdToSave,
            class_name: cls?.name,
            section_name: sec?.name || 'No Section'
        });
        setSelSection('');
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <select
                    value={selClass}
                    onChange={e => {
                        setSelClass(e.target.value);
                        setSelSection('');
                        e.target.blur(); // Auto-close dropdown
                    }}
                    className="w-1/3 px-2 py-1 text-sm border rounded"
                >
                    <option value="">-- Select Class --</option>
                    {classes
                        .slice()
                        .sort((a, b) => {
                            const numA = parseInt(a.name.replace(/\D/g, '') || '0', 10);
                            const numB = parseInt(b.name.replace(/\D/g, '') || '0', 10);
                            return numA === numB ? a.name.localeCompare(b.name) : numA - numB;
                        })
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                    value={selSection}
                    onChange={e => {
                        setSelSection(e.target.value);
                        e.target.blur(); // Auto-close dropdown
                    }}
                    className="w-1/3 px-2 py-1 text-sm border rounded"
                    disabled={!selClass || sections.length === 0}
                >
                    <option value="">{sections.length === 0 && selClass ? 'No Sections' : '-- Select Section --'}</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                    onClick={handleAdd}
                    disabled={!selClass || (!selSection && sections.length > 0)}
                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2 py-1 rounded text-sm font-bold disabled:opacity-50"
                >
                    <Plus size={16} /> Add
                </button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                {selected.map((item, idx) => (
                    <div key={idx} className="bg-slate-100 border border-slate-300 rounded-full px-3 py-1 text-xs flex items-center gap-2 font-bold text-slate-700 whitespace-nowrap">
                        <span className="truncate max-w-[120px] block" title={`${item.class_name} ${item.section_name}`}>{item.class_name} {item.section_name}</span>
                        <button onClick={() => onRemove(idx)} className="hover:text-red-500 flex-shrink-0"><Trash2 size={12} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ExamSchedule;
