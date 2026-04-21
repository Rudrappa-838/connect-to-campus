import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const InstitutionContext = createContext();

export const InstitutionProvider = ({ children }) => {
    const { user } = useAuth();

    // Default to SCHOOL if not specified
    const type = user?.institutionType || 'SCHOOL';

    const labels = useMemo(() => {
        if (type === 'COLLEGE') {
            return {
                institution: 'College',
                INSTITUTION: 'COLLEGE',
                student: 'Student',
                teacher: 'Lecturer',
                class: 'Course', // or Department
                grade: 'Semester',
                principal: 'Principal',
                school_code: 'College Code',

                admin_dashboard: 'College Admin Dashboard',
                school: 'College',
                SCHOOL: 'COLLEGE'
            };
        }
        // Default School Labels
        return {
            institution: 'School',
            INSTITUTION: 'SCHOOL',
            student: 'Student',
            teacher: 'Teacher',
            class: 'Class',
            grade: 'Grade',
            principal: 'Principal',
            school_code: 'School Code',

            admin_dashboard: 'School Admin Dashboard',
            school: 'School',
            SCHOOL: 'SCHOOL'
        };
    }, [type]);

    // Helper to get a label easily
    // Usage: getLabel('institution') -> "School" or "College"
    const getLabel = (key, fallback) => {
        return labels[key] || fallback || key;
    };

    // Add missing 'school' keys to labels map (implicitly done by extending the return objects)
    // Actually we should modify the useMemo above to include 'school' keys.


    return (
        <InstitutionContext.Provider value={{ type, labels, getLabel }}>
            {children}
        </InstitutionContext.Provider>
    );
};

export const useInstitution = () => useContext(InstitutionContext);
