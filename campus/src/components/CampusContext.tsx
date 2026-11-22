'use client';
import {createContext,useContext} from 'react';
import type {Bootstrap} from '@/lib/types';
export const CampusContext=createContext<{data:Bootstrap;refresh:()=>Promise<void>;openChat:(id:string)=>void;setError:(e:string)=>void}>(null!);
export const useCampus=()=>useContext(CampusContext);
